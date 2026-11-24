import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:vinylmania/domain/api_exception.dart';
import 'package:vinylmania/domain/models/library/library_entry.dart';
import 'package:vinylmania/ui/release_detail/view_models/copy_field.dart';
import 'package:vinylmania/ui/release_detail/view_models/detail_status.dart';
import 'package:vinylmania/ui/release_detail/view_models/record_detail_view_model.dart';
import 'package:vinylmania/ui/release_detail/view_models/save_status.dart';

import '../../../helpers/fakes/fake_library_repository.dart';
import '../../../helpers/fakes/fake_streaming_repository.dart';
import '../../../helpers/fixtures/library_fixtures.dart';

LibraryEntry _entryWithCopy(Map<String, Object?> copy) =>
    LibraryEntry.fromJson({
      ...libraryEntryJson,
      'discogs': {...copyDataJson, ...copy},
    });

void main() {
  late FakeLibraryRepository library;
  late FakeStreamingRepository streaming;

  setUp(() {
    library = FakeLibraryRepository();
    streaming = FakeStreamingRepository();
  });

  RecordDetailViewModel build() => RecordDetailViewModel(
    entryId: 'entry-1',
    libraryRepository: library,
    streamingRepository: streaming,
  );

  group('load', () {
    test('entry with release and copy, then streaming links', () async {
      var streamingCalled = false;
      streaming.onLinks = (_, _, _, _) async {
        streamingCalled = true;
        return [];
      };
      final vm = build();
      await vm.load();
      await Future<void>.delayed(Duration.zero);
      expect(vm.status, DetailStatus.ready);
      expect(vm.release!.title, 'Master Of Puppets');
      expect(vm.copy!.rating, 4);
      expect(streamingCalled, isTrue);
    });

    test('catalog unavailable: no release, no streaming lookup', () async {
      var streamingCalled = false;
      streaming.onLinks = (_, _, _, _) async {
        streamingCalled = true;
        return [];
      };
      library.onGet = (_) async => minimalLibraryEntry;
      final vm = build();
      await vm.load();
      expect(vm.status, DetailStatus.ready);
      expect(vm.release, isNull);
      expect(streamingCalled, isFalse);
    });

    test('404 → notFound, other → error', () async {
      library.onGet = (_) async => throw const ApiException(404, 'x', 'x');
      final missing = build();
      await missing.load();
      expect(missing.status, DetailStatus.notFound);

      library.onGet = (_) async =>
          throw const ApiException(0, 'network_error', 'x');
      final failed = build();
      await failed.load();
      expect(failed.status, DetailStatus.error);
    });
  });

  group('per-field autosave', () {
    test('each field sends exactly its own one-field patch', () async {
      final patches = <Map<String, Object>>[];
      library.onUpdateCopy = (_, patch) async {
        patches.add(patch);
        return libraryEntry;
      };
      final vm = build();
      await vm.load();

      await vm.saveRating(2);
      await vm.saveMediaCondition('Mint (M)');
      await vm.saveSleeveCondition('Generic');
      // Notes are not editable in the fixture.
      library.onGet = (_) async => _entryWithCopy({
        'editable': {
          'mediaCondition': true,
          'sleeveCondition': true,
          'notes': true,
        },
      });
      await vm.load();
      await vm.saveNotes('Signed copy');

      expect(patches, [
        {'rating': 2},
        {'mediaCondition': 'Mint (M)'},
        {'sleeveCondition': 'Generic'},
        {'notes': 'Signed copy'},
      ]);
    });

    test('per-field saving → saved, and the copy takes the response', () async {
      final done = Completer<LibraryEntry>();
      library.onUpdateCopy = (_, _) => done.future;
      final vm = build();
      await vm.load();

      final save = vm.saveMediaCondition('Mint (M)');
      expect(vm.statusOf(CopyField.mediaCondition), SaveStatus.saving);
      expect(vm.statusOf(CopyField.sleeveCondition), SaveStatus.idle);

      done.complete(_entryWithCopy({'mediaCondition': 'Mint (M)'}));
      await save;
      expect(vm.statusOf(CopyField.mediaCondition), SaveStatus.saved);
      expect(vm.copy!.mediaCondition, 'Mint (M)');
    });

    test('failure is per field; retry resends the last attempt', () async {
      library.onUpdateCopy = (_, _) async =>
          throw const ApiException(500, 'x', 'x');
      final vm = build();
      await vm.load();
      await vm.saveRating(1);
      expect(vm.statusOf(CopyField.rating), SaveStatus.failed);
      expect(vm.copy!.rating, 4);

      final patches = <Map<String, Object>>[];
      library.onUpdateCopy = (_, patch) async {
        patches.add(patch);
        return _entryWithCopy({'rating': 1});
      };
      await vm.retry(CopyField.rating);
      expect(patches, [
        {'rating': 1},
      ]);
      expect(vm.copy!.rating, 1);
    });

    test('non-editable fields and unchanged notes are not sent', () async {
      var calls = 0;
      library.onUpdateCopy = (_, _) async {
        calls++;
        return libraryEntry;
      };
      library.onGet = (_) async => _entryWithCopy({
        'editable': {
          'mediaCondition': false,
          'sleeveCondition': false,
          'notes': true,
        },
      });
      final vm = build();
      await vm.load();
      await vm.saveMediaCondition('Mint (M)');
      await vm.saveSleeveCondition('Generic');
      await vm.saveNotes('Original pressing');
      expect(calls, 0);
    });
  });

  group('remove', () {
    test('success → true (the screen pops)', () async {
      String? removed;
      library.onRemove = (id) async => removed = id;
      final vm = build();
      await vm.load();
      expect(await vm.remove(), isTrue);
      expect(removed, 'entry-1');
    });

    test('failure → false with the web message', () async {
      library.onRemove = (_) async => throw const ApiException(500, 'x', 'x');
      final vm = build();
      await vm.load();
      expect(await vm.remove(), isFalse);
      expect(vm.removing, isFalse);
      expect(
        vm.removeError,
        'Something went wrong while removing this record. Please try again.',
      );
    });
  });
}
