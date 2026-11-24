import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';
import 'package:vinylmania/domain/api_exception.dart';
import 'package:vinylmania/domain/models/catalog/catalog_filters.dart';
import 'package:vinylmania/domain/models/library/library_entry.dart';
import 'package:vinylmania/domain/models/library/library_sort.dart';
import 'package:vinylmania/domain/models/paged.dart';
import 'package:vinylmania/ui/core/widgets/discogs_link_gate.dart';
import 'package:vinylmania/ui/library/view_models/library_view_model.dart';
import 'package:vinylmania/ui/library/widgets/library_screen.dart';
import 'package:vinylmania/ui/library/widgets/record_card.dart';
import 'package:vinylmania/ui/library/widgets/record_card_skeleton.dart';
import 'package:vinylmania/ui/library/widgets/record_list_row.dart';

import '../../../helpers/fakes/fake_library_repository.dart';
import '../../../helpers/fixtures/library_fixtures.dart';
import '../../../helpers/pump_screen.dart';

void main() {
  late FakeLibraryRepository repository;
  late List<({int page, LibrarySort sort, CatalogFilters filters})> calls;

  setUp(() {
    repository = FakeLibraryRepository();
    calls = [];
    repository.onList = (page, sort, filters, _) async {
      calls.add((page: page, sort: sort, filters: filters));
      return Paged(
        items: [libraryEntry],
        page: page,
        hasMore: false,
        totalItems: 1,
      );
    };
  });

  late LibraryViewModel viewModel;

  Future<void> pump(
    WidgetTester tester, {
    Size size = compactSize,
    ThemeMode mode = ThemeMode.light,
    double textScale = 1,
  }) async {
    await pumpScreen(
      tester,
      LibraryScreen(
        createViewModel: () =>
            viewModel = LibraryViewModel(libraryRepository: repository),
      ),
      size: size,
      mode: mode,
      textScale: textScale,
    );
    await tester.pump();
  }

  for (final (name, size) in [
    ('compact', compactSize),
    ('expanded', expandedSize),
  ]) {
    for (final mode in [ThemeMode.light, ThemeMode.dark]) {
      testWidgets('populated $name $mode meets the a11y guidelines', (
        tester,
      ) async {
        await pump(tester, size: size, mode: mode);

        expect(find.text('Your library'), findsOneWidget);
        expect(find.byType(RecordCard), findsOneWidget);
        expect(find.text('Master Of Puppets'), findsOneWidget);
        expect(find.text('1 record'), findsOneWidget);
        expect(
          find.text("You've reached the end of your collection — 1 record"),
          findsOneWidget,
        );
        await expectA11yGuidelines(tester);
      });
    }

    testWidgets('skeletons while the first page loads ($name)', (tester) async {
      final pending = Completer<Paged<LibraryEntry>>();
      repository.onList = (_, _, _, _) => pending.future;
      await pump(tester, size: size);

      // 8 placeholders, built lazily: only the visible ones exist.
      expect(find.byType(RecordCardSkeleton), findsWidgets);
      expect(find.byType(CircularProgressIndicator), findsNothing);
      final skeleton = tester.getRect(find.byType(RecordCardSkeleton).first);
      pending.complete(
        Paged(items: [libraryEntry], page: 1, hasMore: false, totalItems: 1),
      );
      await tester.pump();
      expect(find.byType(RecordCardSkeleton), findsNothing);
      expect(
        tester.getRect(find.byType(RecordCard).first),
        skeleton,
        reason: 'no layout shift between skeleton and loaded',
      );
    });
  }

  testWidgets('compact toolbar: Sort & Filter sheet changes the sort', (
    tester,
  ) async {
    await pump(tester);

    await tester.tap(find.text('Sort & Filter'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Artist (A → Z)'));
    await tester.pumpAndSettle();

    expect(calls.last.sort, LibrarySort.artistAsc);
    expect(tester.takeAnnouncements().map((a) => a.message), [
      'Sorted by artist, A to Z.',
    ]);
  });

  testWidgets('expanded toolbar: the sort menu changes the sort', (
    tester,
  ) async {
    await pump(tester, size: expandedSize);

    expect(find.text('Sort & Filter'), findsNothing);
    await tester.tap(find.text('Newest first'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Album (Z → A)').last);
    await tester.pumpAndSettle();

    expect(calls.last.sort, LibrarySort.albumDesc);
  });

  testWidgets('filters: a facet sheet applies live and shows the count', (
    tester,
  ) async {
    await pump(tester, size: expandedSize);

    await tester.tap(find.text('Filters'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Genre'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField), 'Rock');
    await tester.pump();
    await tester.tap(find.text('Rock').last);
    await tester.tap(find.text('Apply'));
    await tester.pumpAndSettle();

    expect(calls.last.filters.genre, {'Rock'});
    expect(calls.last.page, 1);
    expect(tester.takeAnnouncements().map((a) => a.message), [
      'Showing 1 record.',
    ]);

    await tester.tap(find.text('Clear all filters'));
    await tester.pumpAndSettle();
    expect(calls.last.filters.isEmpty, isTrue);
    Navigator.of(tester.element(find.text('Clear all filters'))).pop();
    await tester.pumpAndSettle();
    expect(find.text('Filters'), findsOneWidget);
  });

  testWidgets('active filters show as a count in the button label', (
    tester,
  ) async {
    await pump(tester, size: expandedSize);
    await (viewModel.setFilters(
      const CatalogFilters(genre: {'Rock'}, format: {'Vinyl'}),
    ));
    await tester.pump();

    expect(find.text('Filters (2)'), findsOneWidget);
  });

  testWidgets('list mode renders rows', (tester) async {
    await pump(tester);

    await tester.tap(find.bySemanticsLabel('List view'));
    await tester.pump();

    expect(find.byType(RecordListRow), findsOneWidget);
    expect(find.byType(RecordCard), findsNothing);
  });

  testWidgets('a card opens the record detail', (tester) async {
    await pump(tester);

    await tester.tap(find.text('Master Of Puppets'));
    await tester.pumpAndSettle();

    expect(find.text('route: /library/records/entry-1'), findsOneWidget);
  });

  testWidgets('scrolling to the end loads the next batch and announces it', (
    tester,
  ) async {
    repository.onList = (page, sort, filters, _) async {
      calls.add((page: page, sort: sort, filters: filters));
      return Paged(
        items: List.filled(20, libraryEntry),
        page: page,
        hasMore: page == 1,
        totalItems: 40,
      );
    };
    await pump(tester);
    expect(calls.map((c) => c.page), [1]);

    await tester.drag(find.byType(CustomScrollView), const Offset(0, -4000));
    await tester.pump();
    await tester.pump();

    expect(calls.map((c) => c.page), [1, 2]);
    expect(
      tester.takeAnnouncements().map((a) => a.message),
      contains('40 of 40 records loaded. End of collection.'),
    );
  });

  testWidgets('a failed batch offers Retry', (tester) async {
    repository.onList = (page, sort, filters, _) async {
      calls.add((page: page, sort: sort, filters: filters));
      if (page == 2) throw const ApiException(503, 'unavailable', 'down');
      return Paged(
        items: [libraryEntry],
        page: page,
        hasMore: true,
        totalItems: 5,
      );
    };
    await pump(tester);
    await tester.pump();

    expect(
      find.text("Couldn't load more records. Please try again."),
      findsOneWidget,
    );
    await tester.tap(find.text('Retry'));
    await tester.pump();
    expect(calls.where((c) => c.page == 2), hasLength(2));
  });

  testWidgets('empty library and empty filter results', (tester) async {
    repository.onList = (page, _, _, _) async =>
        Paged<LibraryEntry>(items: const [], page: page, hasMore: false);
    await pump(tester);

    expect(
      find.text('No records yet. Add your first one to get started.'),
      findsOneWidget,
    );

    await viewModel.setFilters(const CatalogFilters(style: {'Thrash'}));
    await tester.pump();
    expect(
      find.text(
        'No results for the active filters. Try adjusting or clearing them.',
      ),
      findsOneWidget,
    );
  });

  testWidgets('a load error offers a working Retry', (tester) async {
    repository.onList = (_, _, _, _) async =>
        throw const ApiException(0, 'network_error', 'offline');
    await pump(tester);

    expect(
      find.text(
        'Something went wrong while loading your library. Please try again.',
      ),
      findsOneWidget,
    );
    repository.onList = (page, _, _, _) async =>
        Paged(items: [libraryEntry], page: page, hasMore: false, totalItems: 1);
    await tester.tap(find.text('Retry'));
    await tester.pump();
    await tester.pump();
    expect(find.byType(RecordCard), findsOneWidget);
  });

  testWidgets('refresh failure shows the web message', (tester) async {
    await pump(tester);
    repository.onList = (_, _, _, _) async =>
        throw const ApiException(429, 'rate_limited', 'slow');

    await tester.tap(find.text('Refresh'));
    await tester.pump();
    await tester.pump();

    expect(
      find.text("Couldn't refresh from Discogs right now. Please try again."),
      findsOneWidget,
    );
    expect(find.byType(RecordCard), findsOneWidget);
  });

  testWidgets('the gate replaces the whole list', (tester) async {
    repository.onList = (_, _, _, _) async =>
        throw const ApiException(409, 'discogs_link_invalid', 'relink');
    await pump(tester);

    final gate = tester.widget<DiscogsLinkGate>(find.byType(DiscogsLinkGate));
    expect(gate.relink, isTrue);
    expect(gate.context, 'library');
    expect(find.text('Refresh'), findsNothing);
    expect(find.text('Sort & Filter'), findsNothing);
  });

  testWidgets('200 % text scale does not overflow', (tester) async {
    await pump(tester, textScale: 2);
    expect(tester.takeException(), isNull);
    await tester.tap(find.bySemanticsLabel('List view'));
    await tester.pump();

    expect(tester.takeException(), isNull);
  });
}
