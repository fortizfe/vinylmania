import 'dart:async';

import 'package:flutter/foundation.dart';

import '../../../data/repositories/catalog_repository.dart';
import '../../../data/repositories/library_repository.dart';
import '../../../data/repositories/wantlist_repository.dart';
import '../../../domain/api_exception.dart';
import '../../../domain/catalog_filter_options.dart';
import '../../../domain/models/catalog/catalog_filters.dart';
import '../../../domain/models/catalog/catalog_search_result.dart';
import '../../../domain/models/catalog/catalog_suggestion.dart';
import 'suggestion_state.dart';
import 'results_state.dart';
import '../../../domain/models/library/wantlist_removal.dart';

/// The Discogs gate tripped by an add action; [context] is a
/// `DiscogsLinkGate` context.
typedef SearchGate = ({bool relink, String context});

/// Search screen: debounced suggestions (web `HeaderSearchBox`), infinite
/// results with filters (web `SearchResultsPage`) and the per-result adds.
class SearchViewModel extends ChangeNotifier {
  SearchViewModel({
    required this.catalogRepository,
    required this.libraryRepository,
    required this.wantlistRepository,
    required String initialQuery,
  }) : _query = initialQuery.trim();

  final CatalogRepository catalogRepository;
  final LibraryRepository libraryRepository;
  final WantlistRepository wantlistRepository;

  static const debounce = Duration(milliseconds: 300);

  static String detailPath(String resultType, int discogsId) =>
      resultType == 'master' ? '/masters/$discogsId' : '/releases/$discogsId';

  bool _disposed = false;

  // Suggestions.
  Timer? _debounceTimer;
  int _suggestGeneration = 0;
  SuggestionState _suggestionState = SuggestionState.idle;
  List<CatalogSuggestion> _suggestions = const [];
  String _suggestionQuery = '';

  SuggestionState get suggestionState => _suggestionState;
  List<CatalogSuggestion> get suggestions => _suggestions;
  String get suggestionQuery => _suggestionQuery;

  String get suggestionAnnouncement => switch (_suggestionState) {
    SuggestionState.idle => '',
    SuggestionState.loading => 'Searching…',
    SuggestionState.empty => 'No suggestions for “$_suggestionQuery”.',
    SuggestionState.error => 'Suggestions are unavailable. Retry is available.',
    SuggestionState.suggestions =>
      '${_suggestions.length} '
          '${_suggestions.length == 1 ? 'suggestion' : 'suggestions'} '
          'available.',
  };

  void onFieldChanged(String text) {
    _debounceTimer?.cancel();
    final query = text.trim();
    if (query.length < 2) {
      closeSuggestions();
      return;
    }
    _debounceTimer = Timer(debounce, () => _fetchSuggestions(query));
  }

  void retrySuggestions() => _fetchSuggestions(_suggestionQuery);

  void closeSuggestions() {
    _debounceTimer?.cancel();
    _suggestGeneration++;
    if (_suggestionState == SuggestionState.idle) return;
    _suggestionState = SuggestionState.idle;
    notifyListeners();
  }

  Future<void> _fetchSuggestions(String query) async {
    final generation = ++_suggestGeneration;
    _suggestionQuery = query;
    _suggestionState = SuggestionState.loading;
    notifyListeners();
    try {
      final found = await catalogRepository.suggest(query);
      if (generation != _suggestGeneration) return;
      _suggestions = found;
      _suggestionState = found.isEmpty
          ? SuggestionState.empty
          : SuggestionState.suggestions;
    } on ApiException {
      if (generation != _suggestGeneration) return;
      _suggestionState = SuggestionState.error;
    }
    notifyListeners();
  }

  /// The location to push for a release/master; null for an artist, whose
  /// name becomes the new search instead.
  String? pick(CatalogSuggestion suggestion) {
    closeSuggestions();
    if (suggestion.resultType == 'artist') {
      submit(suggestion.title);
      return null;
    }
    return detailPath(suggestion.resultType, suggestion.discogsId);
  }

  // Results.
  String _query;
  CatalogFilters _filters = CatalogFilters.none;
  ResultsState _resultsState = ResultsState.idle;
  List<CatalogSearchResult> _results = const [];
  int _page = 0;
  bool _hasMore = false;
  bool _loadingMore = false;
  bool _loadMoreFailed = false;
  int _searchGeneration = 0;

  String get query => _query;
  CatalogFilters get filters => _filters;
  ResultsState get resultsState => _resultsState;
  List<CatalogSearchResult> get results => _results;
  bool get hasMore => _hasMore;
  bool get isLoadingMore => _loadingMore;
  bool get loadMoreFailed => _loadMoreFailed;
  int get activeFilterCount =>
      _filters.genre.length + _filters.style.length + _filters.format.length;

  String get emptyMessage {
    final active = [
      for (final (label, selected, options) in [
        ('Genre', _filters.genre, genreOptions),
        ('Style', _filters.style, styleOptions),
        ('Format', _filters.format, formatOptions),
      ])
        if (selected.isNotEmpty)
          '$label: ${options.where(selected.contains).join(', ')}',
    ];
    return active.isEmpty
        ? 'No results found. Try a different search.'
        : 'No results found for the active filters (${active.join(', ')}). '
              'Try adjusting or clearing them.';
  }

  Future<void> load() => _reload();

  Future<void> retry() => _reload();

  /// Blank text is ignored (web `handleSubmit`); filters are kept.
  void submit(String text) {
    closeSuggestions();
    final query = text.trim();
    if (query.isEmpty) return;
    _query = query;
    unawaited(_reload());
  }

  void setFilters(CatalogFilters filters) {
    _filters = filters;
    unawaited(_reload());
  }

  void clearFilters() => setFilters(CatalogFilters.none);

  Future<void> _reload() async {
    final generation = ++_searchGeneration;
    _results = const [];
    _page = 0;
    _hasMore = false;
    _loadingMore = false;
    _loadMoreFailed = false;
    if (_query.isEmpty) {
      _resultsState = ResultsState.idle;
      notifyListeners();
      return;
    }
    _resultsState = ResultsState.loading;
    notifyListeners();
    try {
      final page = await catalogRepository.search(_query, filters: _filters);
      if (generation != _searchGeneration) return;
      _results = page.items;
      _page = page.page;
      _hasMore = page.hasMore;
      _resultsState = ResultsState.loaded;
    } on ApiException catch (e) {
      if (generation != _searchGeneration) return;
      _resultsState = e.code == 'discogs_link_invalid'
          ? ResultsState.relink
          : ResultsState.error;
    }
    notifyListeners();
  }

  Future<void> loadMore() async {
    if (_resultsState != ResultsState.loaded ||
        !_hasMore ||
        _loadingMore ||
        _loadMoreFailed) {
      return;
    }
    final generation = _searchGeneration;
    _loadingMore = true;
    notifyListeners();
    try {
      final page = await catalogRepository.search(
        _query,
        page: _page + 1,
        filters: _filters,
      );
      if (generation != _searchGeneration) return;
      _results = [..._results, ...page.items];
      _page = page.page;
      _hasMore = page.hasMore;
    } on ApiException {
      if (generation != _searchGeneration) return;
      _loadMoreFailed = true;
    }
    _loadingMore = false;
    notifyListeners();
  }

  Future<void> retryLoadMore() {
    _loadMoreFailed = false;
    return loadMore();
  }

  // Add actions.
  final _addingToLibrary = <int>{};
  final _inLibrary = <int>{};
  final _addingToWishlist = <int>{};
  final _inWishlist = <int>{};
  SearchGate? _gate;
  String? _notice;
  String? _actionError;

  bool isAddingToLibrary(int id) => _addingToLibrary.contains(id);
  bool isInLibrary(int id) => _inLibrary.contains(id);
  bool isAddingToWishlist(int id) => _addingToWishlist.contains(id);
  bool isInWishlist(int id) => _inWishlist.contains(id);
  SearchGate? get gate => _gate;

  /// Non-blocking note after a successful add.
  String? get notice => _notice;
  String? get actionError => _actionError;

  Future<void> addToLibrary(int releaseId) => _add(
    releaseId,
    pending: _addingToLibrary,
    done: _inLibrary,
    gateContext: 'add-to-library',
    errorMessage:
        'Something went wrong while adding this record. Please try again.',
    action: () async {
      final entry = await libraryRepository.add(releaseId);
      return entry.wantlistRemoval == WantlistRemoval.failed
          ? "Added to your library. We couldn't remove it from your "
                'wishlist — remove it there when you can.'
          : null;
    },
  );

  Future<void> addToWishlist(int releaseId) => _add(
    releaseId,
    pending: _addingToWishlist,
    done: _inWishlist,
    gateContext: 'add-to-wishlist',
    errorMessage:
        'Something went wrong while adding this record to your wishlist. '
        'Please try again.',
    action: () async {
      final result = await wantlistRepository.add(releaseId);
      return result.alreadyInLibrary
          ? 'Added to your wishlist — already in your library.'
          : null;
    },
  );

  Future<void> _add(
    int releaseId, {
    required Set<int> pending,
    required Set<int> done,
    required String gateContext,
    required String errorMessage,
    required Future<String?> Function() action,
  }) async {
    if (pending.contains(releaseId) || done.contains(releaseId)) return;
    pending.add(releaseId);
    _gate = null;
    _notice = null;
    _actionError = null;
    notifyListeners();
    try {
      _notice = await action();
      done.add(releaseId);
    } on ApiException catch (e) {
      if (e.code == 'discogs_not_linked' || e.code == 'discogs_link_invalid') {
        _gate = (
          relink: e.code == 'discogs_link_invalid',
          context: gateContext,
        );
      } else {
        _actionError = errorMessage;
      }
    }
    pending.remove(releaseId);
    notifyListeners();
  }

  @override
  void notifyListeners() {
    if (!_disposed) super.notifyListeners();
  }

  @override
  void dispose() {
    _disposed = true;
    _debounceTimer?.cancel();
    super.dispose();
  }
}
