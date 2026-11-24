import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:vinylmania/domain/api_exception.dart';
import 'package:vinylmania/domain/models/catalog/catalog_filters.dart';
import 'package:vinylmania/domain/models/library/library_entry.dart';
import 'package:vinylmania/domain/models/library/library_sort.dart';
import 'package:vinylmania/domain/models/paged.dart';
import 'package:vinylmania/ui/library/view_models/library_view_model.dart';

import '../../../helpers/fakes/fake_library_repository.dart';
import '../../../helpers/fixtures/library_fixtures.dart';

typedef Call = ({
  int page,
  LibrarySort sort,
  CatalogFilters filters,
  bool refresh,
});

void main() {
  late FakeLibraryRepository repository;
  late List<Call> calls;
  late LibraryViewModel viewModel;

  Paged<LibraryEntry> page(
    int n, {
    bool hasMore = false,
    int size = 2,
    int total = 6,
  }) => Paged(
    items: List.filled(size, n.isOdd ? libraryEntry : minimalLibraryEntry),
    page: n,
    hasMore: hasMore,
    totalItems: total,
  );

  setUp(() {
    repository = FakeLibraryRepository();
    calls = [];
    repository.onList = (p, sort, filters, refresh) async {
      calls.add((page: p, sort: sort, filters: filters, refresh: refresh));
      return page(p, hasMore: p < 3);
    };
    viewModel = LibraryViewModel(libraryRepository: repository);
  });

  tearDown(() => viewModel.dispose());

  test('starts loading and shows the first page', () async {
    expect(viewModel.isLoading, isTrue);
    await viewModel.load();

    expect(viewModel.isLoading, isFalse);
    expect(viewModel.entries, hasLength(2));
    expect(viewModel.hasMore, isTrue);
    expect(viewModel.totalItems, 6);
    expect(calls.single.page, 1);
    expect(calls.single.sort, LibrarySort.newestFirst);
    expect(viewModel.takeAnnouncement(), isNull);
  });

  test('loadMore appends the next page and announces progress', () async {
    await viewModel.load();
    await viewModel.loadMore();

    expect(viewModel.entries, hasLength(4));
    expect(calls.map((c) => c.page), [1, 2]);
    expect(viewModel.takeAnnouncement(), '4 of 6 records loaded.');

    await viewModel.loadMore();
    expect(viewModel.hasMore, isFalse);
    expect(
      viewModel.takeAnnouncement(),
      '6 of 6 records loaded. End of collection.',
    );

    await viewModel.loadMore(); // nothing left
    expect(calls, hasLength(3));
  });

  test('loadMore ignores calls while a page is in flight', () async {
    await viewModel.load();
    final pending = Completer<Paged<LibraryEntry>>();
    repository.onList = (_, _, _, _) => pending.future;

    final first = viewModel.loadMore();
    expect(viewModel.isLoadingMore, isTrue);
    await viewModel.loadMore();
    pending.complete(page(2, hasMore: true));
    await first;

    expect(viewModel.entries, hasLength(4));
    expect(viewModel.isLoadingMore, isFalse);
  });

  test('a failed next page keeps the records and retries on demand', () async {
    await viewModel.load();
    repository.onList = (_, _, _, _) async =>
        throw const ApiException(503, 'unavailable', 'down');

    await viewModel.loadMore();
    expect(viewModel.loadMoreFailed, isTrue);
    expect(viewModel.entries, hasLength(2));
    expect(viewModel.loadError, isNull);

    repository.onList = (p, _, _, _) async => page(p);
    await viewModel.loadMore(); // explicit Retry
    expect(viewModel.loadMoreFailed, isFalse);
    expect(viewModel.entries, hasLength(4));
  });

  test('setSort resets paging, reloads and announces the sort', () async {
    await viewModel.load();
    await viewModel.loadMore();

    final change = viewModel.setSort(LibrarySort.artistAsc);
    expect(viewModel.isLoading, isTrue);
    expect(viewModel.entries, isEmpty);
    await change;

    expect(viewModel.sort, LibrarySort.artistAsc);
    expect(calls.last.page, 1);
    expect(calls.last.sort, LibrarySort.artistAsc);
    expect(viewModel.entries, hasLength(2));
    expect(viewModel.takeAnnouncement(), 'Sorted by artist, A to Z.');
    expect(viewModel.takeAnnouncement(), isNull, reason: 'consumed once');
  });

  test('setFilters resets paging and announces the result count', () async {
    await viewModel.load();
    const rock = CatalogFilters(genre: {'Rock'});

    await viewModel.setFilters(rock);
    expect(calls.last.filters, rock);
    expect(calls.last.page, 1);
    expect(viewModel.filters, rock);
    expect(viewModel.activeFilterCount, 1);
    expect(viewModel.takeAnnouncement(), 'Showing 6 records.');

    repository.onList = (p, _, _, _) async => page(p, size: 1, total: 1);
    await viewModel.setFilters(const CatalogFilters(genre: {'Jazz'}));
    expect(viewModel.takeAnnouncement(), 'Showing 1 record.');

    repository.onList = (p, _, _, _) async => page(p, size: 0, total: 0);
    await viewModel.setFilters(const CatalogFilters(style: {'Thrash'}));
    expect(
      viewModel.takeAnnouncement(),
      'No records match the active filters.',
    );
  });

  test('a stale response for an abandoned sort is dropped', () async {
    final slow = Completer<Paged<LibraryEntry>>();
    repository.onList = (p, sort, _, _) =>
        sort == LibrarySort.albumAsc ? slow.future : Future.value(page(p));

    final abandoned = viewModel.setSort(LibrarySort.albumAsc);
    await viewModel.setSort(LibrarySort.albumDesc);
    slow.complete(page(1, size: 5));
    await abandoned;

    expect(viewModel.sort, LibrarySort.albumDesc);
    expect(viewModel.entries, hasLength(2));
  });

  test('refresh syncs from Discogs and resets to the first page', () async {
    await viewModel.load();
    await viewModel.loadMore();

    final refreshing = viewModel.refresh();
    expect(viewModel.isRefreshing, isTrue);
    await refreshing;

    expect(viewModel.isRefreshing, isFalse);
    expect(calls.last.refresh, isTrue);
    expect(calls.last.page, 1);
    expect(viewModel.entries, hasLength(2));
  });

  test('a failed refresh keeps the records and flags the error', () async {
    await viewModel.load();
    repository.onList = (_, _, _, _) async =>
        throw const ApiException(429, 'rate_limited', 'slow down');

    await viewModel.refresh();
    expect(viewModel.refreshFailed, isTrue);
    expect(viewModel.entries, hasLength(2));
  });

  test('a refresh overtaken by a sort change stops loading', () async {
    await viewModel.load();
    final slow = Completer<Paged<LibraryEntry>>();
    repository.onList = (p, _, _, refresh) =>
        refresh ? slow.future : Future.value(page(p, size: 1));

    final refreshing = viewModel.refresh();
    await viewModel.setSort(LibrarySort.albumDesc);
    slow.complete(page(1, size: 5));
    await refreshing;

    expect(viewModel.isRefreshing, isFalse);
    expect(viewModel.entries, hasLength(1));
  });

  test('a refresh overtaken by a silent reload stops loading', () async {
    await viewModel.load();
    final slow = Completer<Paged<LibraryEntry>>();
    repository.onList = (p, _, _, refresh) =>
        refresh ? slow.future : Future.value(page(p, size: 1));

    final refreshing = viewModel.refresh();
    await repository.remove('entry-1');
    await pumpEventQueue();
    slow.complete(page(1, size: 5));
    await refreshing;

    expect(viewModel.isRefreshing, isFalse);
    expect(viewModel.entries, hasLength(1));
  });

  test('a refresh pending at dispose finishes quietly', () async {
    final vm = LibraryViewModel(libraryRepository: repository);
    await vm.load();
    final slow = Completer<Paged<LibraryEntry>>();
    repository.onList = (_, _, _, _) => slow.future;

    final refreshing = vm.refresh();
    vm.dispose();
    slow.complete(page(1));
    await refreshing;
  });

  test('reloads the first page when the repository changes', () async {
    await viewModel.load();
    await repository.remove('entry-1');
    await pumpEventQueue();

    expect(calls.map((c) => c.page), [1, 1]);
  });

  test('stops listening to the repository once disposed', () async {
    final vm = LibraryViewModel(libraryRepository: repository);
    await vm.load();
    vm.dispose();
    await repository.remove('entry-1');
    await pumpEventQueue();

    // The shared viewModel never loaded, so it isn't listening either.
    expect(calls, hasLength(1));
  });

  for (final (code, relink) in [
    ('discogs_not_linked', false),
    ('discogs_link_invalid', true),
  ]) {
    test('$code shows the gate', () async {
      repository.onList = (_, _, _, _) async =>
          throw ApiException(409, code, 'link');
      await viewModel.load();

      expect(viewModel.isGated, isTrue);
      expect(viewModel.needsRelink, relink);
    });
  }

  test('any other first-load failure is a retryable error', () async {
    repository.onList = (_, _, _, _) async =>
        throw const ApiException(0, 'network_error', 'offline');
    await viewModel.load();

    expect(viewModel.loadError, isNotNull);
    expect(viewModel.isGated, isFalse);

    repository.onList = (p, _, _, _) async => page(p);
    await viewModel.load();
    expect(viewModel.loadError, isNull);
    expect(viewModel.entries, hasLength(2));
  });
}
