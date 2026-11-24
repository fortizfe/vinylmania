import 'dart:async';

import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';
import 'package:vinylmania/domain/api_exception.dart';
import 'package:vinylmania/domain/models/catalog/catalog_filters.dart';
import 'package:vinylmania/domain/models/catalog/catalog_search_result.dart';
import 'package:vinylmania/domain/models/paged.dart';
import 'package:vinylmania/ui/search/view_models/search_view_model.dart';
import 'package:vinylmania/ui/search/widgets/search_result_card.dart';
import 'package:vinylmania/ui/search/widgets/search_result_card_skeleton.dart';
import 'package:vinylmania/ui/search/widgets/search_result_list_row.dart';
import 'package:vinylmania/ui/search/widgets/search_screen.dart';

import '../../../helpers/fakes/fake_catalog_repository.dart';
import '../../../helpers/fakes/fake_library_repository.dart';
import '../../../helpers/fakes/fake_wantlist_repository.dart';
import '../../../helpers/pump_screen.dart';

CatalogSearchResult _result(int id, {String type = 'release'}) =>
    CatalogSearchResult(
      discogsId: id,
      resultType: type,
      title: 'Record $id',
      artist: 'Artist $id',
      year: 1990,
      formats: const ['Vinyl', 'LP'],
      country: 'UK',
      labels: ['Label $id'],
    );

void main() {
  late FakeCatalogRepository catalog;
  late FakeLibraryRepository library;
  late FakeWantlistRepository wantlist;

  SearchViewModel vm([String q = 'metallica']) => SearchViewModel(
    catalogRepository: catalog,
    libraryRepository: library,
    wantlistRepository: wantlist,
    initialQuery: q,
  );

  Future<void> pump(
    WidgetTester tester, {
    String q = 'metallica',
    Size size = compactSize,
    ThemeMode mode = ThemeMode.light,
    double textScale = 1,
  }) async {
    await pumpScreen(
      tester,
      SearchScreen(createViewModel: () => vm(q)),
      size: size,
      mode: mode,
      textScale: textScale,
    );
    await tester.pump();
  }

  setUp(() {
    catalog = FakeCatalogRepository();
    library = FakeLibraryRepository();
    wantlist = FakeWantlistRepository();
  });

  testWidgets('no query: hint copy, field autofocused, a11y', (tester) async {
    await pump(tester, q: '');

    expect(
      find.text(
        'Use the search box above to look up a record in the Discogs catalog.',
      ),
      findsOneWidget,
    );
    final field = tester.widget<TextField>(find.byType(TextField));
    expect(field.autofocus, isTrue);
    await expectA11yGuidelines(tester);
  });

  testWidgets('loading shows card skeletons, no spinner', (tester) async {
    catalog.onSearch = (_, _, _) => Completer<Never>().future;
    await pump(tester);

    expect(find.byType(SearchResultCardSkeleton), findsWidgets);
    expect(find.byType(CircularProgressIndicator), findsNothing);
  });

  for (final (size, mode) in [
    (compactSize, ThemeMode.light),
    (expandedSize, ThemeMode.dark),
  ]) {
    testWidgets('grid results at $size $mode: actions + a11y', (tester) async {
      catalog.onSearch = (_, page, _) async => Paged(
        items: [
          _result(1),
          _result(2, type: 'master'),
        ],
        page: page,
        hasMore: false,
      );
      await pump(tester, size: size, mode: mode);

      expect(find.byType(SearchResultCard), findsNWidgets(2));
      expect(find.bySemanticsLabel('Add to library'), findsOneWidget);
      expect(find.bySemanticsLabel('Add to wishlist'), findsOneWidget);
      expect(find.text('Multiple editions'), findsOneWidget);
      expect(find.text('No more results.'), findsOneWidget);
      await expectA11yGuidelines(tester);
    });
  }

  testWidgets('add actions show their state in label + icon', (tester) async {
    catalog.onSearch = (_, page, _) async =>
        Paged(items: [_result(1)], page: page, hasMore: false);
    await pump(tester);

    await tester.tap(find.bySemanticsLabel('Add to library'));
    await tester.tap(find.bySemanticsLabel('Add to wishlist'));
    await tester.pump();

    expect(find.bySemanticsLabel('Added to library'), findsOneWidget);
    expect(find.byIcon(Icons.check), findsOneWidget);
    expect(find.bySemanticsLabel('In your wishlist'), findsOneWidget);
    expect(find.byIcon(Icons.favorite), findsOneWidget);
    expect(
      find.text('Added to your wishlist — already in your library.'),
      findsOneWidget,
    );
  });

  testWidgets('add gate shows inline and goes to profile', (tester) async {
    catalog.onSearch = (_, page, _) async =>
        Paged(items: [_result(1)], page: page, hasMore: false);
    library.onAdd = (_) async =>
        throw const ApiException(409, 'discogs_not_linked', 'x');
    await pump(tester);

    await tester.tap(find.bySemanticsLabel('Add to library'));
    await tester.pump();

    expect(
      find.text(
        'You need to link your Discogs account before adding records to '
        'your library.',
      ),
      findsOneWidget,
    );
    await tester.tap(find.text('Go to your profile'));
    await tester.pumpAndSettle();
    expect(find.text('route: /profile'), findsOneWidget);
  });

  testWidgets('list view rows with details; result tap opens detail', (
    tester,
  ) async {
    catalog.onSearch = (_, page, _) async =>
        Paged(items: [_result(1)], page: page, hasMore: false);
    await pump(tester, size: expandedSize);

    await tester.tap(find.bySemanticsLabel('List view'));
    await tester.pump();

    expect(find.byType(SearchResultListRow), findsOneWidget);
    expect(find.text('Vinyl, LP'), findsOneWidget);
    expect(find.text('Label 1'), findsOneWidget);
    await expectA11yGuidelines(tester);

    await tester.tap(find.text('Record 1'));
    await tester.pumpAndSettle();
    expect(find.text('route: /releases/1'), findsOneWidget);
  });

  testWidgets('empty, error with retry, and relink', (tester) async {
    catalog.onSearch = (_, page, _) async =>
        Paged(items: const [], page: page, hasMore: false);
    await pump(tester);
    expect(
      find.text('No results found. Try a different search.'),
      findsOneWidget,
    );

    var attempts = 0;
    catalog.onSearch = (_, page, _) async {
      attempts++;
      throw const ApiException(500, 'internal_error', 'x');
    };
    await pump(tester, q: 'slayer');
    expect(
      find.text('Something went wrong while searching. Please try again.'),
      findsOneWidget,
    );
    await tester.tap(find.text('Retry'));
    await tester.pump();
    expect(attempts, 2);

    catalog.onSearch = (_, _, _) async =>
        throw const ApiException(401, 'discogs_link_invalid', 'x');
    await pump(tester, q: 'megadeth');
    expect(
      find.text(
        'Your Discogs link is no longer valid. Please re-link your account '
        'from your profile.',
      ),
      findsOneWidget,
    );
  });

  testWidgets('filters: facet count and clear', (tester) async {
    final seen = <CatalogFilters>[];
    catalog.onSearch = (_, page, f) async {
      seen.add(f);
      return Paged(items: [_result(1)], page: page, hasMore: false);
    };
    await pump(tester);

    await tester.tap(find.text('Format'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Acetate'));
    await tester.tap(find.text('Apply'));
    await tester.pumpAndSettle();

    expect(find.text('Format (1)'), findsOneWidget);
    expect(seen.last.format, {'Acetate'});

    await tester.tap(find.text('Clear filters'));
    await tester.pump();
    expect(find.text('Format'), findsOneWidget);
    expect(seen.last.isEmpty, isTrue);
  });

  testWidgets('suggestions: debounced list, announcement, pick, Esc', (
    tester,
  ) async {
    await pump(tester, q: '');

    await tester.enterText(find.byType(TextField), 'master');
    await tester.pump(const Duration(milliseconds: 300));
    await tester.pump();

    expect(find.bySemanticsLabel('2 suggestions available.'), findsOneWidget);
    expect(find.text('Album'), findsOneWidget);
    expect(find.text('Artist'), findsOneWidget);
    await expectA11yGuidelines(tester);

    await tester.sendKeyEvent(LogicalKeyboardKey.escape);
    await tester.pump();
    expect(find.text('Album'), findsNothing);

    await tester.enterText(find.byType(TextField), 'master of');
    await tester.pump(const Duration(milliseconds: 300));
    await tester.pump();
    await tester.tap(find.text('Album'));
    await tester.pumpAndSettle();
    expect(find.text('route: /masters/6513'), findsOneWidget);
  });

  testWidgets('suggestion loading rows are skeletons', (tester) async {
    catalog.onSuggest = (_) => Completer<Never>().future;
    await pump(tester, q: '');

    await tester.enterText(find.byType(TextField), 'metal');
    await tester.pump(const Duration(milliseconds: 300));

    expect(find.bySemanticsLabel('Searching…'), findsOneWidget);
    expect(find.byType(CircularProgressIndicator), findsNothing);
  });

  testWidgets('scrolling near the end loads the next page with skeletons', (
    tester,
  ) async {
    final pages = <int>[];
    final next = Completer<Paged<CatalogSearchResult>>();
    catalog.onSearch = (_, page, _) {
      pages.add(page);
      if (page > 1) return next.future;
      return Future.value(
        Paged(
          items: [for (var i = 0; i < 20; i++) _result(i)],
          page: 1,
          hasMore: true,
        ),
      );
    };
    await pump(tester);

    await tester.drag(find.byType(CustomScrollView), const Offset(0, -4000));
    await tester.pump();

    expect(pages, [1, 2]);
    expect(
      find.byType(SearchResultCardSkeleton, skipOffstage: false),
      findsWidgets,
    );
    expect(pages, [1, 2]);
    next.complete(Paged(items: [_result(99)], page: 2, hasMore: false));
    await tester.pump();
    await tester.drag(find.byType(CustomScrollView), const Offset(0, -8000));
    await tester.pump(const Duration(seconds: 1));
    expect(find.text('No more results.', skipOffstage: false), findsOneWidget);
  });

  testWidgets('200 % text, compact, no overflow', (tester) async {
    await pump(tester, textScale: 2);
    expect(tester.takeException(), isNull);
    await tester.tap(find.bySemanticsLabel('List view'));
    await tester.pump();
    expect(tester.takeException(), isNull);
  });
}
