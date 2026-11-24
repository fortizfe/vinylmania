import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';
import 'package:vinylmania/domain/api_exception.dart';
import 'package:vinylmania/domain/models/catalog/master_release.dart';
import 'package:vinylmania/domain/models/paged.dart';
import 'package:vinylmania/ui/core/open_external_link.dart';
import 'package:vinylmania/ui/core/widgets/skeleton.dart';
import 'package:vinylmania/ui/release_detail/view_models/master_detail_view_model.dart';
import 'package:vinylmania/ui/release_detail/widgets/master_detail_screen.dart';

import '../../../helpers/fakes/fake_catalog_repository.dart';
import '../../../helpers/fakes/fake_streaming_repository.dart';
import '../../../helpers/fixtures/catalog_fixtures.dart';
import '../../../helpers/pump_screen.dart';

import 'package:vinylmania/ui/core/widgets/vm_card.dart';
import 'package:vinylmania/ui/release_detail/widgets/detail_skeleton.dart';
import 'package:vinylmania/ui/release_detail/widgets/release_gallery.dart';

void main() {
  late FakeCatalogRepository catalog;

  setUp(() => catalog = FakeCatalogRepository());

  Future<void> pump(
    WidgetTester tester, {
    int id = 6513,
    Size size = compactSize,
    double textScale = 1,
  }) async {
    await pumpScreen(
      tester,
      MasterDetailScreen(
        createViewModel: () => MasterDetailViewModel(
          masterId: id,
          catalogRepository: catalog,
          streamingRepository: FakeStreamingRepository(),
        ),
      ),
      size: size,
      textScale: textScale,
    );
    await tester.pump();
  }

  for (final size in [compactSize, expandedSize]) {
    testWidgets('skeleton while loading, no layout shift ($size)', (
      tester,
    ) async {
      final done = Completer<MasterRelease>();
      catalog.onGetMaster = (_) => done.future;
      await pump(tester, size: size);
      expect(find.byType(Skeleton), findsWidgets);
      final skeleton = _galleryCard(tester);

      done.complete(master);
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
    testWidgets('populated $name: details, versions, streaming', (
      tester,
    ) async {
      await pump(tester, size: size);
      expect(find.text('Master Of Puppets'), findsWidgets);
      expect(find.text('1986'), findsWidgets);
      expect(find.text('View on Discogs'), findsOneWidget);
      expect(find.text('Tracklist'), findsOneWidget);
      expect(find.text('Versions'), findsOneWidget);
      expect(find.text('Escúchalo en streaming'), findsOneWidget);
      await expectA11yGuidelines(tester);

      final version = find.bySemanticsLabel(RegExp('^Master Of Puppets')).last;
      await tester.ensureVisible(version);
      await tester.tap(version);
      await tester.pumpAndSettle();
      expect(find.textContaining('route: /releases/'), findsOneWidget);
    });
  }

  testWidgets('compact version row reads format · year · label · country', (
    tester,
  ) async {
    await pump(tester);
    expect(find.text('Vinyl, LP, Album · 1986 · Elektra · US'), findsOneWidget);
    expect(find.text('—'), findsOneWidget, reason: 'the minimal version');
  });

  testWidgets('versions pager: Next loads page 2', (tester) async {
    final pages = <int>[];
    catalog.onGetMasterVersions = (_, page) async {
      pages.add(page);
      return Paged(items: [masterVersion], page: page, hasMore: page < 2);
    };
    await pump(tester);
    await tester.ensureVisible(find.text('Next'));
    await tester.tap(find.text('Next'));
    await tester.pump();
    await tester.pump();
    expect(pages, [1, 2]);
  });

  testWidgets('versions error', (tester) async {
    catalog.onGetMasterVersions = (_, _) async =>
        throw const ApiException(500, 'x', 'x');
    await pump(tester);
    expect(
      find.text("Couldn't load this master's versions. Please try again."),
      findsOneWidget,
    );
  });

  testWidgets('View on Discogs opens the master page', (tester) async {
    final opened = <Uri>[];
    final original = launchExternalUrl;
    launchExternalUrl = (uri) async {
      opened.add(uri);
      return true;
    };
    addTearDown(() => launchExternalUrl = original);
    await pump(tester);
    await tester.ensureVisible(find.text('View on Discogs'));
    await tester.tap(find.text('View on Discogs'));
    expect(opened, [Uri.parse('https://www.discogs.com/master/6513')]);
  });

  testWidgets('not found', (tester) async {
    await pump(tester, id: 0);
    expect(
      find.text("Couldn't find that master release in the catalog."),
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
