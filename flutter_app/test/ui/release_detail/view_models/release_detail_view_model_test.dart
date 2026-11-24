import 'dart:async';
import 'dart:ui';

import 'package:flutter_test/flutter_test.dart';
import 'package:vinylmania/domain/api_exception.dart';
import 'package:vinylmania/domain/models/library/library_entry.dart';
import 'package:vinylmania/domain/models/wantlist/add_to_wantlist_result.dart';
import 'package:vinylmania/ui/release_detail/view_models/detail_status.dart';
import 'package:vinylmania/ui/release_detail/view_models/release_detail_view_model.dart';
import 'package:vinylmania/ui/release_detail/view_models/save_status.dart';

import '../../../helpers/fakes/fake_catalog_repository.dart';
import '../../../helpers/fakes/fake_library_repository.dart';
import '../../../helpers/fakes/fake_streaming_repository.dart';
import '../../../helpers/fakes/fake_wantlist_repository.dart';
import '../../../helpers/fixtures/catalog_fixtures.dart';
import '../../../helpers/fixtures/library_fixtures.dart';
import '../../../helpers/fixtures/wantlist_fixtures.dart';

void main() {
  late FakeCatalogRepository catalog;
  late FakeLibraryRepository library;
  late FakeWantlistRepository wantlist;
  late FakeStreamingRepository streaming;

  setUp(() {
    catalog = FakeCatalogRepository();
    library = FakeLibraryRepository();
    wantlist = FakeWantlistRepository();
    streaming = FakeStreamingRepository();
  });

  ReleaseDetailViewModel build({int id = 249504}) => ReleaseDetailViewModel(
    releaseId: id,
    catalogRepository: catalog,
    libraryRepository: library,
    wantlistRepository: wantlist,
    streamingRepository: streaming,
  );

  group('load', () {
    test('fetches the release and wantlist membership in parallel', () async {
      final releaseDone = Completer<void>();
      var wantlistAsked = false;
      catalog.onGetRelease = (_) async {
        await releaseDone.future;
        return release;
      };
      wantlist.onGet = (_) async {
        wantlistAsked = true;
        return wantEntryDetail;
      };
      final vm = build();

      final load = vm.load();
      expect(vm.status, DetailStatus.loading);
      await Future<void>.delayed(Duration.zero);
      expect(wantlistAsked, isTrue, reason: 'not waiting for the release');

      releaseDone.complete();
      await load;
      expect(vm.status, DetailStatus.ready);
      expect(vm.release, same(release));
      expect(vm.isInWantlist, isTrue);
      expect(vm.wantEntry!.rating, 3);
    });

    test('a wantlist failure just means "not in the wantlist"', () async {
      wantlist.onGet = (_) async =>
          throw const ApiException(500, 'internal_error', 'x');
      final vm = build();
      await vm.load();
      expect(vm.status, DetailStatus.ready);
      expect(vm.isInWantlist, isFalse);
    });

    test('id 0 is not found without calling the backend', () async {
      var called = false;
      catalog.onGetRelease = (_) async {
        called = true;
        return release;
      };
      final vm = build(id: 0);
      await vm.load();
      expect(vm.status, DetailStatus.notFound);
      expect(called, isFalse);
    });

    test('404 → notFound, discogs_link_invalid → relink, else error', () async {
      final cases = {
        const ApiException(404, 'not_found', 'x'): DetailStatus.notFound,
        const ApiException(401, 'discogs_link_invalid', 'x'):
            DetailStatus.relink,
        const ApiException(0, 'network_error', 'x'): DetailStatus.error,
      };
      for (final MapEntry(key: error, value: expected) in cases.entries) {
        catalog.onGetRelease = (_) async => throw error;
        final vm = build();
        await vm.load();
        expect(vm.status, expected, reason: error.code);
      }
    });

    test(
      'streaming links load after the release with the device locale',
      () async {
        final calls = <List<Object>>[];
        streaming.onLinks = (barcodes, artist, title, locale) async {
          calls.add([barcodes, artist, title, locale]);
          return [];
        };
        final vm = build();
        await vm.load();
        await Future<void>.delayed(Duration.zero);

        expect(calls, [
          [
            ['075596043910'],
            'Metallica',
            'Master Of Puppets',
            PlatformDispatcher.instance.locale.toLanguageTag(),
          ],
        ]);
        expect(vm.streaming.loading, isFalse);
      },
    );

    test('no streaming lookup without an artist', () async {
      var called = false;
      streaming.onLinks = (_, _, _, _) async {
        called = true;
        return [];
      };
      catalog.onGetRelease = (_) async => minimalRelease;
      final vm = build();
      await vm.load();
      expect(called, isFalse);
      expect(vm.streaming.links, isEmpty);
    });
  });

  group('add to library', () {
    test('success marks it added', () async {
      final vm = build();
      await vm.load();
      await vm.addToLibrary();
      expect(vm.addedToLibrary, isTrue);
      expect(vm.notice, isNull);
      expect(vm.libraryError, isNull);
    });

    test('wantlistRemoval failed → the web notice', () async {
      library.onAdd = (_) async => LibraryEntry.fromJson({
        ...libraryEntryJson,
        'wantlistRemoval': 'failed',
      });
      final vm = build();
      await vm.load();
      await vm.addToLibrary();
      expect(
        vm.notice,
        "Added to your library. We couldn't remove it from your wishlist — "
        'remove it there when you can.',
      );
    });

    test('wantlistRemoval removed → no longer in the wantlist', () async {
      wantlist.onGet = (_) async => wantEntryDetail;
      library.onAdd = (_) async => LibraryEntry.fromJson({
        ...libraryEntryJson,
        'wantlistRemoval': 'removed',
      });
      final vm = build();
      await vm.load();
      await vm.addToLibrary();
      expect(vm.isInWantlist, isFalse);
    });

    test('gate codes and generic error', () async {
      final vm = build();
      await vm.load();

      library.onAdd = (_) async =>
          throw const ApiException(409, 'discogs_not_linked', 'x');
      await vm.addToLibrary();
      expect(vm.gate, (relink: false, context: 'add-to-library'));

      library.onAdd = (_) async =>
          throw const ApiException(401, 'discogs_link_invalid', 'x');
      await vm.addToLibrary();
      expect(vm.gate, (relink: true, context: 'add-to-library'));

      library.onAdd = (_) async => throw const ApiException(500, 'x', 'x');
      await vm.addToLibrary();
      expect(vm.gate, isNull);
      expect(
        vm.libraryError,
        'Something went wrong while adding this record. Please try again.',
      );
      expect(vm.addedToLibrary, isFalse);
    });

    test('in-flight flag', () async {
      final done = Completer<LibraryEntry>();
      library.onAdd = (_) => done.future;
      final vm = build();
      await vm.load();
      final add = vm.addToLibrary();
      expect(vm.addingToLibrary, isTrue);
      done.complete(libraryEntry);
      await add;
      expect(vm.addingToLibrary, isFalse);
    });
  });

  group('add to wishlist', () {
    test(
      'already in library note, then wantlist membership refreshes',
      () async {
        final vm = build();
        await vm.load();
        expect(vm.isInWantlist, isFalse);

        wantlist.onGet = (_) async => wantEntryDetail;
        await vm.addToWishlist();
        expect(vm.addedToWishlist, isTrue);
        expect(vm.notice, 'This is already in your library.');
        expect(vm.isInWantlist, isTrue);
      },
    );

    test('plain add note', () async {
      wantlist.onAdd = (_) async => AddToWantlistResult.fromJson({
        ...addToWantlistResultJson,
        'alreadyInLibrary': false,
      });
      final vm = build();
      await vm.load();
      await vm.addToWishlist();
      expect(vm.notice, 'Added to your wishlist.');
    });

    test('gate codes and generic error', () async {
      final vm = build();
      await vm.load();

      wantlist.onAdd = (_) async =>
          throw const ApiException(409, 'discogs_not_linked', 'x');
      await vm.addToWishlist();
      expect(vm.gate, (relink: false, context: 'add-to-wishlist'));

      wantlist.onAdd = (_) async => throw const ApiException(500, 'x', 'x');
      await vm.addToWishlist();
      expect(vm.gate, isNull);
      expect(
        vm.wishlistError,
        'Something went wrong while adding this record to your wishlist. '
        'Please try again.',
      );
    });
  });

  group('personal rating', () {
    test('saves through the wantlist and keeps the returned value', () async {
      wantlist.onGet = (_) async => wantEntryDetail;
      int? sent;
      wantlist.onUpdate = (_, rating, _) async {
        sent = rating;
        return minimalWantEntryDetail;
      };
      final vm = build();
      await vm.load();
      await vm.saveRating(5);
      expect(sent, 5);
      expect(vm.wantEntry!.rating, 0);
      expect(vm.ratingStatus, SaveStatus.idle);
    });

    test('failure keeps the persisted value; retry resends it', () async {
      wantlist.onGet = (_) async => wantEntryDetail;
      wantlist.onUpdate = (_, _, _) async =>
          throw const ApiException(500, 'x', 'x');
      final vm = build();
      await vm.load();
      await vm.saveRating(5);
      expect(vm.ratingStatus, SaveStatus.failed);
      expect(vm.wantEntry!.rating, 3);

      int? sent;
      wantlist.onUpdate = (_, rating, _) async {
        sent = rating;
        return wantEntryDetail;
      };
      await vm.retryRating();
      expect(sent, 5);
      expect(vm.ratingStatus, SaveStatus.idle);
    });
  });

  test('dispose while loading does not throw', () async {
    final done = Completer<void>();
    catalog.onGetRelease = (_) async {
      await done.future;
      return release;
    };
    var lookups = 0;
    streaming.onLinks = (_, _, _, _) async {
      lookups++;
      return [];
    };
    final vm = build();
    final load = vm.load();
    vm.dispose();
    done.complete();
    await load;
    expect(lookups, 0);
  });
}
