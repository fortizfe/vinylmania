import 'dart:async';

import 'package:fake_async/fake_async.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:vinylmania/domain/api_exception.dart';
import 'package:vinylmania/domain/models/catalog/catalog_filters.dart';
import 'package:vinylmania/domain/models/catalog/catalog_search_result.dart';
import 'package:vinylmania/domain/models/catalog/catalog_suggestion.dart';
import 'package:vinylmania/domain/models/library/library_entry.dart';
import 'package:vinylmania/domain/models/paged.dart';
import 'package:vinylmania/domain/models/wantlist/add_to_wantlist_result.dart';
import 'package:vinylmania/ui/search/view_models/search_view_model.dart';

import '../../../helpers/fakes/fake_catalog_repository.dart';
import '../../../helpers/fakes/fake_library_repository.dart';
import '../../../helpers/fakes/fake_wantlist_repository.dart';
import '../../../helpers/fixtures/catalog_fixtures.dart';
import '../../../helpers/fixtures/library_fixtures.dart';
import '../../../helpers/fixtures/wantlist_fixtures.dart';

import 'package:vinylmania/ui/search/view_models/suggestion_state.dart';
import 'package:vinylmania/ui/search/view_models/results_state.dart';
import 'package:vinylmania/domain/models/library/wantlist_removal.dart';

CatalogSearchResult _result(int id) => CatalogSearchResult(
  discogsId: id,
  resultType: 'release',
  title: 'Record $id',
);

Paged<CatalogSearchResult> _page(int page, {bool hasMore = true}) => Paged(
  items: [for (var i = 0; i < 20; i++) _result(page * 100 + i)],
  page: page,
  hasMore: hasMore,
);

void main() {
  late FakeCatalogRepository catalog;
  late FakeLibraryRepository library;
  late FakeWantlistRepository wantlist;

  SearchViewModel build([String initialQuery = '']) => SearchViewModel(
    catalogRepository: catalog,
    libraryRepository: library,
    wantlistRepository: wantlist,
    initialQuery: initialQuery,
  );

  setUp(() {
    catalog = FakeCatalogRepository();
    library = FakeLibraryRepository();
    wantlist = FakeWantlistRepository();
  });

  group('suggestions', () {
    test('debounce 300 ms and ≥ 2 chars before asking the backend', () {
      fakeAsync((async) {
        final queries = <String>[];
        final pending = Completer<List<CatalogSuggestion>>();
        catalog.onSuggest = (q) {
          queries.add(q);
          return pending.future;
        };
        final vm = build();

        vm.onFieldChanged('m');
        async.elapse(const Duration(seconds: 1));
        expect(queries, isEmpty);
        expect(vm.suggestionState, SuggestionState.idle);

        vm.onFieldChanged('me');
        async.elapse(const Duration(milliseconds: 200));
        vm.onFieldChanged(' met ');
        async.elapse(const Duration(milliseconds: 299));
        expect(queries, isEmpty);
        async.elapse(const Duration(milliseconds: 1));
        expect(vm.suggestionState, SuggestionState.loading);
        expect(vm.suggestionAnnouncement, 'Searching…');
        expect(queries, ['met']);
        pending.complete([suggestion, minimalSuggestion]);
        async.flushMicrotasks();

        expect(vm.suggestionState, SuggestionState.suggestions);
        expect(vm.suggestions, hasLength(2));
        expect(vm.suggestionAnnouncement, '2 suggestions available.');
      });
    });

    test('dropping below 2 chars closes the panel at once', () {
      fakeAsync((async) {
        final vm = build();
        vm.onFieldChanged('metal');
        async.elapse(const Duration(milliseconds: 300));
        async.flushMicrotasks();
        expect(vm.suggestionState, SuggestionState.suggestions);

        vm.onFieldChanged('m');
        expect(vm.suggestionState, SuggestionState.idle);
        expect(vm.suggestionAnnouncement, '');
      });
    });

    test('empty, error + retry, and stale responses are ignored', () {
      fakeAsync((async) {
        final slow = Completer<List<Never>>();
        catalog.onSuggest = (q) => q == 'slow' ? slow.future : Future.value([]);
        final vm = build();

        vm.onFieldChanged('slow');
        async.elapse(const Duration(milliseconds: 300));
        vm.onFieldChanged('zz');
        async.elapse(const Duration(milliseconds: 300));
        async.flushMicrotasks();
        expect(vm.suggestionState, SuggestionState.empty);
        expect(vm.suggestionAnnouncement, 'No suggestions for “zz”.');

        slow.complete([]);
        async.flushMicrotasks();
        expect(vm.suggestionQuery, 'zz');

        catalog.onSuggest = (_) async =>
            throw const ApiException(503, 'unavailable', 'x');
        vm.retrySuggestions();
        async.flushMicrotasks();
        expect(vm.suggestionState, SuggestionState.error);
        expect(
          vm.suggestionAnnouncement,
          'Suggestions are unavailable. Retry is available.',
        );

        catalog.onSuggest = (_) async => [suggestion];
        vm.retrySuggestions();
        async.flushMicrotasks();
        expect(vm.suggestionAnnouncement, '1 suggestion available.');
      });
    });

    test('pick: release/master → detail path, artist → results', () async {
      final vm = build();

      expect(vm.pick(suggestion), '/masters/6513');
      expect(
        vm.pick(
          const CatalogSuggestion(
            discogsId: 42,
            resultType: 'release',
            title: 'Kill Em All',
          ),
        ),
        '/releases/42',
      );
      expect(vm.suggestionState, SuggestionState.idle);

      expect(vm.pick(minimalSuggestion), isNull);
      expect(vm.query, 'Metallica');
      await pumpEventQueue();
      expect(vm.resultsState, ResultsState.loaded);
    });
  });

  group('results', () {
    test('no query → idle; initial query loads page 1', () async {
      final idle = build();
      await idle.load();
      expect(idle.resultsState, ResultsState.idle);

      final queries = <(String, int)>[];
      catalog.onSearch = (q, page, _) async {
        queries.add((q, page));
        return _page(page);
      };
      final vm = build(' metallica ');
      final loading = vm.load();
      expect(vm.resultsState, ResultsState.loading);
      await loading;

      expect(queries, [('metallica', 1)]);
      expect(vm.resultsState, ResultsState.loaded);
      expect(vm.results, hasLength(20));
    });

    test('submit ignores blank text and keeps the active filters', () async {
      final seen = <CatalogFilters>[];
      catalog.onSearch = (_, page, f) async {
        seen.add(f);
        return _page(page, hasMore: false);
      };
      final vm = build();
      vm.setFilters(const CatalogFilters(genre: {'Rock'}));
      await pumpEventQueue();
      vm.submit('   ');
      expect(vm.query, '');

      vm.submit('slayer');
      await pumpEventQueue();
      expect(vm.query, 'slayer');
      expect(seen.single.genre, {'Rock'});
    });

    test('infinite paging: no double fetch, stops at hasMore=false', () async {
      final pending = <int, Completer<Paged<CatalogSearchResult>>>{};
      catalog.onSearch = (_, page, _) {
        if (page == 1) return Future.value(_page(1));
        return (pending[page] = Completer()).future;
      };
      final vm = build('metal');
      await vm.load();

      unawaited(vm.loadMore());
      unawaited(vm.loadMore());
      expect(vm.isLoadingMore, isTrue);
      expect(pending.keys, [2]);
      pending[2]!.complete(_page(2, hasMore: false));
      await pumpEventQueue();

      expect(vm.results, hasLength(40));
      expect(vm.hasMore, isFalse);
      await vm.loadMore();
      expect(pending.keys, [2]);
    });

    test('a failed next page keeps results and retries on demand', () async {
      var fail = true;
      catalog.onSearch = (_, page, _) async {
        if (page == 2 && fail) throw const ApiException(503, 'x', 'x');
        return _page(page);
      };
      final vm = build('metal');
      await vm.load();

      await vm.loadMore();
      expect(vm.loadMoreFailed, isTrue);
      expect(vm.results, hasLength(20));
      await vm.loadMore();
      expect(vm.results, hasLength(20));

      fail = false;
      await vm.retryLoadMore();
      expect(vm.loadMoreFailed, isFalse);
      expect(vm.results, hasLength(40));
    });

    test('filters reset to page 1 and drop stale pages', () async {
      final calls = <(int, CatalogFilters)>[];
      catalog.onSearch = (_, page, f) async {
        calls.add((page, f));
        return _page(page);
      };
      final vm = build('metal');
      await vm.load();
      await vm.loadMore();

      vm.setFilters(const CatalogFilters(format: {'Vinyl'}));
      expect(vm.results, isEmpty);
      expect(vm.resultsState, ResultsState.loading);
      await pumpEventQueue();

      expect(calls.last.$1, 1);
      expect(calls.last.$2.format, {'Vinyl'});
      expect(vm.results, hasLength(20));
      expect(vm.activeFilterCount, 1);

      vm.clearFilters();
      await pumpEventQueue();
      expect(calls.last.$2.isEmpty, isTrue);
    });

    test('empty message names the active filters', () async {
      catalog.onSearch = (_, page, _) async =>
          Paged(items: const [], page: page, hasMore: false);
      final vm = build('metal');
      await vm.load();
      expect(vm.emptyMessage, 'No results found. Try a different search.');

      vm.setFilters(
        const CatalogFilters(genre: {'Rock', 'Blues'}, format: {'Vinyl'}),
      );
      await pumpEventQueue();
      expect(
        vm.emptyMessage,
        'No results found for the active filters (Genre: Blues, Rock, '
        'Format: Vinyl). Try adjusting or clearing them.',
      );
    });

    test('search error vs discogs_link_invalid relink', () async {
      catalog.onSearch = (_, _, _) async =>
          throw const ApiException(500, 'internal_error', 'x');
      final vm = build('metal');
      await vm.load();
      expect(vm.resultsState, ResultsState.error);

      catalog.onSearch = (_, _, _) async =>
          throw const ApiException(401, 'discogs_link_invalid', 'x');
      await vm.retry();
      expect(vm.resultsState, ResultsState.relink);
    });
  });

  group('add actions', () {
    test('add to library: in-flight, added, ignores repeats', () async {
      final pending = Completer<LibraryEntry>();
      var calls = 0;
      library.onAdd = (_) {
        calls++;
        return pending.future;
      };
      final vm = build();

      final first = vm.addToLibrary(7);
      expect(vm.isAddingToLibrary(7), isTrue);
      unawaited(vm.addToLibrary(7));
      pending.complete(libraryEntry);
      await first;

      expect(calls, 1);
      expect(vm.isAddingToLibrary(7), isFalse);
      expect(vm.isInLibrary(7), isTrue);
      await vm.addToLibrary(7);
      expect(calls, 1);
    });

    test('wantlistRemoval failed → notice', () async {
      library.onAdd = (_) async => LibraryEntry(
        id: 'e1',
        discogsReleaseId: 7,
        addedAt: DateTime(2024),
        isCatalogAvailable: true,
        wantlistRemoval: WantlistRemoval.failed,
      );
      final vm = build();
      await vm.addToLibrary(7);
      expect(
        vm.notice,
        "Added to your library. We couldn't remove it from your wishlist — "
        'remove it there when you can.',
      );
    });

    test('add to wishlist: in wishlist + already-in-library note', () async {
      final vm = build();
      await vm.addToWishlist(7);
      expect(vm.isInWishlist(7), isTrue);
      expect(vm.notice, 'Added to your wishlist — already in your library.');

      wantlist.onAdd = (_) async => AddToWantlistResult(
        entry: wantEntry,
        alreadyInWantlist: false,
        alreadyInLibrary: false,
      );
      await vm.addToWishlist(8);
      expect(vm.notice, isNull);
    });

    test('gate codes per destination and generic errors', () async {
      final vm = build();
      library.onAdd = (_) async =>
          throw const ApiException(409, 'discogs_not_linked', 'x');
      await vm.addToLibrary(1);
      expect(vm.gate, (relink: false, context: 'add-to-library'));
      expect(vm.isInLibrary(1), isFalse);

      wantlist.onAdd = (_) async =>
          throw const ApiException(401, 'discogs_link_invalid', 'x');
      await vm.addToWishlist(1);
      expect(vm.gate, (relink: true, context: 'add-to-wishlist'));

      wantlist.onAdd = (_) async => throw const ApiException(500, 'x', 'x');
      await vm.addToWishlist(1);
      expect(vm.gate, isNull);
      expect(
        vm.actionError,
        'Something went wrong while adding this record to your wishlist. '
        'Please try again.',
      );

      library.onAdd = (_) async => throw const ApiException(0, 'x', 'x');
      await vm.addToLibrary(1);
      expect(
        vm.actionError,
        'Something went wrong while adding this record. Please try again.',
      );
    });
  });

  test('dispose cancels the debounce and late responses are dropped', () {
    fakeAsync((async) {
      final suggested = <String>[];
      catalog.onSuggest = (q) async {
        suggested.add(q);
        return [suggestion];
      };
      final vm = build('metal');
      unawaited(vm.load());
      vm.onFieldChanged('metallica');
      vm.dispose();
      async.elapse(const Duration(seconds: 1));
      async.flushMicrotasks();
      expect(suggested, isEmpty);
    });
  });
}
