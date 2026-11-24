import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';
import 'package:vinylmania/domain/api_exception.dart';
import 'package:vinylmania/domain/models/catalog/release.dart';
import 'package:vinylmania/ui/core/widgets/skeleton.dart';
import 'package:vinylmania/ui/core/widgets/star_rating.dart';
import 'package:vinylmania/ui/release_detail/view_models/release_detail_view_model.dart';
import 'package:vinylmania/ui/release_detail/widgets/release_detail_screen.dart';

import '../../../helpers/fakes/fake_catalog_repository.dart';
import '../../../helpers/fakes/fake_library_repository.dart';
import '../../../helpers/fakes/fake_streaming_repository.dart';
import '../../../helpers/fakes/fake_wantlist_repository.dart';
import '../../../helpers/fixtures/catalog_fixtures.dart';
import '../../../helpers/fixtures/wantlist_fixtures.dart';
import '../../../helpers/pump_screen.dart';

import 'package:vinylmania/ui/core/widgets/vm_card.dart';
import 'package:vinylmania/ui/release_detail/widgets/detail_skeleton.dart';
import 'package:vinylmania/ui/release_detail/widgets/release_gallery.dart';

void main() {
  late FakeCatalogRepository catalog;
  late FakeLibraryRepository library;
  late FakeWantlistRepository wantlist;

  setUp(() {
    catalog = FakeCatalogRepository();
    library = FakeLibraryRepository();
    wantlist = FakeWantlistRepository();
  });

  Future<void> pump(
    WidgetTester tester, {
    int id = 249504,
    Size size = compactSize,
    ThemeMode mode = ThemeMode.light,
    double textScale = 1,
  }) async {
    await pumpScreen(
      tester,
      ReleaseDetailScreen(
        createViewModel: () => ReleaseDetailViewModel(
          releaseId: id,
          catalogRepository: catalog,
          libraryRepository: library,
          wantlistRepository: wantlist,
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
      final done = Completer<Release>();
      catalog.onGetRelease = (_) => done.future;
      await pump(tester, size: size);
      expect(find.byType(Skeleton), findsWidgets);
      expect(find.text('Master Of Puppets'), findsNothing);
      final skeleton = _galleryCard(tester);

      done.complete(release);
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
        expect(find.text('Metallica'), findsOneWidget);
        expect(find.text('Vinyl (LP, Album)'), findsOneWidget);
        expect(find.text('Elektra (60439-1)'), findsOneWidget);
        expect(find.text('Valoración'), findsOneWidget);
        expect(find.text('Tracklist'), findsOneWidget);
        expect(find.text('A1. Battery (5:10)'), findsOneWidget);
        expect(find.text('Más información'), findsOneWidget);
        expect(find.text('Barcode: 075596043910 (Text)'), findsOneWidget);
        expect(find.text('Escúchalo en streaming'), findsOneWidget);
        expect(find.text('Add to library'), findsOneWidget);
        expect(find.text('Add to wishlist'), findsOneWidget);
        expect(find.byType(StarRating), findsNothing);
        await expectA11yGuidelines(tester);
      });
    }
  }

  testWidgets('expanded: media rail left of the liner notes', (tester) async {
    await pump(tester, size: expandedSize);
    final rating = tester.getTopLeft(find.text('Valoración'));
    final tracklist = tester.getTopLeft(find.text('Tracklist'));
    expect(rating.dx, lessThan(tracklist.dx));
  });

  testWidgets('in the wishlist: personal stars, no "Add to wishlist"', (
    tester,
  ) async {
    wantlist.onGet = (_) async => wantEntryDetail;
    int? sent;
    wantlist.onUpdate = (_, rating, _) async {
      sent = rating;
      return wantEntryDetail;
    };
    await pump(tester);
    expect(find.byType(StarRating), findsOneWidget);
    expect(find.text('Add to wishlist'), findsNothing);
    await tester.ensureVisible(find.byKey(const ValueKey('star-5')));
    await tester.tap(find.byKey(const ValueKey('star-5')));
    await tester.pump();
    expect(sent, 5);
  });

  testWidgets('add to library → added; gate shows the link card', (
    tester,
  ) async {
    await pump(tester);
    await tester.tap(find.text('Add to library'));
    await tester.pump();
    expect(find.text('Added to library'), findsOneWidget);

    wantlist.onAdd = (_) async =>
        throw const ApiException(409, 'discogs_not_linked', 'x');
    await tester.tap(find.text('Add to wishlist'));
    await tester.pump();
    expect(
      find.text(
        'You need to link your Discogs account before adding records to '
        'your wishlist.',
      ),
      findsOneWidget,
    );
  });

  testWidgets('not found', (tester) async {
    await pump(tester, id: 0);
    expect(
      find.text("Couldn't find that release in the catalog."),
      findsOneWidget,
    );
    await expectA11yGuidelines(tester);
  });

  testWidgets('relink', (tester) async {
    catalog.onGetRelease = (_) async =>
        throw const ApiException(401, 'discogs_link_invalid', 'x');
    await pump(tester);
    expect(
      find.text(
        'Your Discogs link is no longer valid. Please re-link your account '
        'from your profile.',
      ),
      findsOneWidget,
    );
    await tester.tap(find.text('Go to your profile'));
    await tester.pumpAndSettle();
    expect(find.text('route: /profile'), findsOneWidget);
  });

  testWidgets('error → Retry reloads', (tester) async {
    catalog.onGetRelease = (_) async =>
        throw const ApiException(0, 'network_error', 'x');
    await pump(tester);
    expect(
      find.text("Couldn't load this release. Please try again."),
      findsOneWidget,
    );
    catalog.onGetRelease = (_) async => release;
    await tester.tap(find.text('Retry'));
    await tester.pump();
    await tester.pump();
    expect(find.text('Tracklist'), findsOneWidget);
  });

  testWidgets('Back falls back to search when there is no history', (
    tester,
  ) async {
    await pump(tester);
    await tester.tap(find.bySemanticsLabel('Back'));
    await tester.pumpAndSettle();
    expect(find.text('route: /search'), findsOneWidget);
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
