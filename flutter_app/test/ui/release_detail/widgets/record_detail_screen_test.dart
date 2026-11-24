import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';
import 'package:vinylmania/domain/api_exception.dart';
import 'package:vinylmania/domain/models/library/library_entry.dart';
import 'package:vinylmania/ui/core/widgets/skeleton.dart';
import 'package:vinylmania/ui/core/widgets/star_rating.dart';
import 'package:vinylmania/ui/release_detail/view_models/record_detail_view_model.dart';
import 'package:vinylmania/ui/release_detail/widgets/record_detail_screen.dart';

import '../../../helpers/fakes/fake_library_repository.dart';
import '../../../helpers/fakes/fake_streaming_repository.dart';
import '../../../helpers/fixtures/library_fixtures.dart';
import '../../../helpers/pump_screen.dart';

import 'package:vinylmania/ui/core/widgets/vm_card.dart';
import 'package:vinylmania/ui/release_detail/widgets/detail_skeleton.dart';
import 'package:vinylmania/ui/release_detail/widgets/release_gallery.dart';

void main() {
  late FakeLibraryRepository library;

  setUp(() => library = FakeLibraryRepository());

  Future<void> pump(
    WidgetTester tester, {
    Size size = compactSize,
    ThemeMode mode = ThemeMode.light,
    double textScale = 1,
  }) async {
    await pumpScreen(
      tester,
      RecordDetailScreen(
        createViewModel: () => RecordDetailViewModel(
          entryId: 'entry-1',
          libraryRepository: library,
          streamingRepository: FakeStreamingRepository(),
        ),
      ),
      size: size,
      mode: mode,
      textScale: textScale,
    );
    await tester.pump();
  }

  for (final size in [compactSize, expandedSize]) {
    testWidgets('skeleton while loading, no layout shift ($size)', (
      tester,
    ) async {
      final done = Completer<LibraryEntry>();
      library.onGet = (_) => done.future;
      await pump(tester, size: size);
      expect(find.byType(Skeleton), findsWidgets);
      final skeleton = _galleryCard(tester);

      done.complete(libraryEntry);
      await tester.pump();
      expect(find.byType(DetailSkeleton), findsNothing);
      expect(
        _galleryCard(tester),
        skeleton,
        reason: 'no layout shift between skeleton and loaded',
      );
    });
  }

  for (final (name, size) in [
    ('compact', compactSize),
    ('expanded', expandedSize),
  ]) {
    for (final mode in [ThemeMode.light, ThemeMode.dark]) {
      testWidgets('populated $name ${mode.name}', (tester) async {
        await pump(tester, size: size, mode: mode);
        expect(find.text('Master Of Puppets'), findsWidgets);
        expect(find.text('Your copy'), findsOneWidget);
        expect(find.text('Remove from library'), findsOneWidget);
        expect(find.text('Add to library'), findsNothing);
        expect(find.byType(StarRating), findsOneWidget);
        expect(find.text('Tracklist'), findsOneWidget);
        await expectA11yGuidelines(tester);
      });
    }
  }

  testWidgets('personal rating autosaves from the rating card', (tester) async {
    final patches = <Map<String, Object>>[];
    library.onUpdateCopy = (_, patch) async {
      patches.add(patch);
      return libraryEntry;
    };
    await pump(tester);
    await tester.ensureVisible(find.byKey(const ValueKey('star-2')));
    await tester.tap(find.byKey(const ValueKey('star-2')));
    await tester.pump();
    expect(patches, [
      {'rating': 2},
    ]);
  });

  testWidgets('catalog unavailable: notice, my copy and remove remain', (
    tester,
  ) async {
    library.onGet = (_) async => LibraryEntry.fromJson({
      ...minimalLibraryEntryJson,
      'discogs': copyDataJson,
    });
    await pump(tester);
    expect(
      find.text("Couldn't load catalog details for this record right now."),
      findsOneWidget,
    );
    expect(find.text('Your copy'), findsOneWidget);
    expect(find.text('Remove from library'), findsOneWidget);
  });

  testWidgets('remove → confirm → back to the library', (tester) async {
    String? removed;
    library.onRemove = (id) async => removed = id;
    await pump(tester);
    await tester.tap(find.text('Remove from library'));
    await tester.pumpAndSettle();
    expect(
      find.text('Remove this record from your library? This cannot be undone.'),
      findsOneWidget,
    );
    await tester.tap(find.text('Remove'));
    await tester.pumpAndSettle();
    expect(removed, 'entry-1');
    expect(find.text('route: /library'), findsOneWidget);
  });

  testWidgets('remove cancelled does nothing; failure shows the message', (
    tester,
  ) async {
    var calls = 0;
    library.onRemove = (_) async {
      calls++;
      throw const ApiException(500, 'x', 'x');
    };
    await pump(tester);
    await tester.tap(find.text('Remove from library'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Cancel'));
    await tester.pumpAndSettle();
    expect(calls, 0);

    await tester.tap(find.text('Remove from library'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Remove'));
    await tester.pumpAndSettle();
    expect(
      find.text(
        'Something went wrong while removing this record. Please try again.',
      ),
      findsOneWidget,
    );
  });

  testWidgets('not found', (tester) async {
    library.onGet = (_) async => throw const ApiException(404, 'x', 'x');
    await pump(tester);
    expect(
      find.text("Couldn't find that record in your library."),
      findsOneWidget,
    );
  });

  testWidgets('200 % text without overflow, both layouts', (tester) async {
    for (final size in [compactSize, expandedSize]) {
      await pump(tester, size: size, textScale: 2);
      expect(tester.takeException(), isNull);
    }
  });
}

/// The gallery card: the first card of the skeleton, the one around the
/// gallery once loaded.
Rect _galleryCard(WidgetTester tester) {
  final skeleton = find.descendant(
    of: find.byType(DetailSkeleton),
    matching: find.byType(VmCard),
  );
  return tester.getRect(
    skeleton.evaluate().isNotEmpty
        ? skeleton.first
        : find
              .ancestor(
                of: find.byType(ReleaseGallery),
                matching: find.byType(VmCard),
              )
              .first,
  );
}
