import 'package:flutter/foundation.dart';

import '../../../data/repositories/library_repository.dart';
import '../../../domain/api_exception.dart';
import '../../../domain/models/catalog/catalog_filters.dart';
import '../../../domain/models/library/library_entry.dart';
import '../../../domain/models/library/library_sort.dart';

/// Library list (web `LibraryListPage`): infinite paging over one sort +
/// filter selection, Discogs refresh, gate, and screen-reader announcements.
class LibraryViewModel extends ChangeNotifier {
  LibraryViewModel({required this.libraryRepository});

  final LibraryRepository libraryRepository;

  LibrarySort _sort = LibrarySort.newestFirst;
  CatalogFilters _filters = CatalogFilters.none;
  List<LibraryEntry> _entries = const [];
  int _page = 0;
  bool _hasMore = false;
  int? _totalItems;
  bool _isLoading = true;
  bool _isLoadingMore = false;
  bool _loadMoreFailed = false;
  bool _isRefreshing = false;
  bool _refreshFailed = false;
  ApiException? _loadError;
  String? _announcement;
  bool _listening = false;
  bool _disposed = false;

  /// Bumped by every new selection (and dispose): a response from an older
  /// generation is dropped, so an abandoned sort can't render or announce.
  int _generation = 0;

  LibrarySort get sort => _sort;
  CatalogFilters get filters => _filters;
  List<LibraryEntry> get entries => _entries;
  bool get hasMore => _hasMore;

  /// Records matching the current selection, across all pages.
  int get totalItems => _totalItems ?? _entries.length;
  bool get isLoading => _isLoading;
  bool get isLoadingMore => _isLoadingMore;
  bool get loadMoreFailed => _loadMoreFailed;
  bool get isRefreshing => _isRefreshing;
  bool get refreshFailed => _refreshFailed;

  /// First-page failure that isn't the Discogs gate.
  ApiException? get loadError => isGated ? null : _loadError;
  bool get isGated => _loadError?.code == 'discogs_not_linked' || needsRelink;
  bool get needsRelink => _loadError?.code == 'discogs_link_invalid';
  int get activeFilterCount =>
      _filters.genre.length + _filters.style.length + _filters.format.length;

  /// The pending screen-reader announcement, returned once.
  String? takeAnnouncement() {
    final message = _announcement;
    _announcement = null;
    return message;
  }

  /// Loads (or retries) the first page of the current selection.
  Future<void> load() {
    if (!_listening) {
      // Registered on first load, not in the constructor: a ViewModel the
      // router builds but the screen never uses holds no listener.
      libraryRepository.addListener(_reloadSilently);
      _listening = true;
    }
    return _loadFirstPage(announce: null);
  }

  Future<void> setSort(LibrarySort sort) {
    _sort = sort;
    return _loadFirstPage(announce: () => sort.announcement);
  }

  Future<void> setFilters(CatalogFilters filters) {
    _filters = filters;
    return _loadFirstPage(
      announce: () => totalItems == 0
          ? 'No records match the active filters.'
          : 'Showing $totalItems ${_records(totalItems)}.',
    );
  }

  /// Next batch; also the explicit Retry after a failed batch.
  Future<void> loadMore() async {
    if (!_hasMore || _isLoadingMore || _isLoading) return;
    final generation = _generation;
    _isLoadingMore = true;
    _loadMoreFailed = false;
    notifyListeners();
    try {
      final next = await libraryRepository.list(
        page: _page + 1,
        sort: _sort,
        filters: _filters,
      );
      if (generation != _generation) return;
      _entries = [..._entries, ...next.items];
      _page = next.page;
      _hasMore = next.hasMore;
      _totalItems = next.totalItems ?? _totalItems;
      final loaded = '${_entries.length} of $totalItems records loaded.';
      _announcement = _hasMore ? loaded : '$loaded End of collection.';
    } on ApiException {
      if (generation != _generation) return;
      _loadMoreFailed = true;
    }
    _isLoadingMore = false;
    notifyListeners();
  }

  /// Forces a Discogs sync and resets the list to its first batch.
  Future<void> refresh() async {
    final generation = ++_generation;
    _isRefreshing = true;
    _refreshFailed = false;
    _isLoadingMore = false;
    notifyListeners();
    try {
      final first = await libraryRepository.list(
        sort: _sort,
        filters: _filters,
        refresh: true,
      );
      // A newer selection or reload owns the list; only the button resets.
      if (generation == _generation) {
        _show(first.items, first.page, first.hasMore, first.totalItems);
      }
    } on ApiException {
      if (generation == _generation) _refreshFailed = true;
    }
    _isRefreshing = false;
    notifyListeners();
  }

  Future<void> _loadFirstPage({required String Function()? announce}) async {
    final generation = ++_generation;
    _isLoading = true;
    _isLoadingMore = false;
    _loadMoreFailed = false;
    _loadError = null;
    _entries = const [];
    notifyListeners();
    try {
      final first = await libraryRepository.list(
        sort: _sort,
        filters: _filters,
      );
      if (generation != _generation) return;
      _show(first.items, first.page, first.hasMore, first.totalItems);
      _announcement = announce?.call();
    } on ApiException catch (e) {
      if (generation != _generation) return;
      _loadError = e;
    }
    _isLoading = false;
    notifyListeners();
  }

  /// After a mutation elsewhere (add/remove/edit): refetch the first page
  /// without flashing skeletons; on failure keep what's on screen.
  Future<void> _reloadSilently() async {
    final generation = ++_generation;
    _isLoadingMore = false;
    try {
      final first = await libraryRepository.list(
        sort: _sort,
        filters: _filters,
      );
      if (generation != _generation) return;
      _show(first.items, first.page, first.hasMore, first.totalItems);
      _isLoading = false;
      notifyListeners();
    } on ApiException catch (e) {
      // Loaded records stay; only a first load it superseded shows the error.
      if (generation != _generation || !_isLoading) return;
      _loadError = e;
      _isLoading = false;
      notifyListeners();
    }
  }

  void _show(
    List<LibraryEntry> items,
    int page,
    bool hasMore,
    int? totalItems,
  ) {
    _entries = items;
    _totalItems = totalItems;
    _page = page;
    _hasMore = hasMore;
    _loadError = null;
    _loadMoreFailed = false;
  }

  static String _records(int n) => n == 1 ? 'record' : 'records';

  @override
  void notifyListeners() {
    if (!_disposed) super.notifyListeners();
  }

  @override
  void dispose() {
    _disposed = true;
    _generation++;
    if (_listening) libraryRepository.removeListener(_reloadSilently);
    super.dispose();
  }
}
