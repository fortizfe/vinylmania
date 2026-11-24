import 'package:flutter/foundation.dart';

import '../../../data/repositories/wantlist_repository.dart';
import '../../../domain/api_exception.dart';
import '../../../domain/models/wantlist/want_entry.dart';

/// Wishlist (web `WishlistPage`): classic Previous/Next paging, Discogs
/// refresh, remove, gate.
class WishlistViewModel extends ChangeNotifier {
  WishlistViewModel({required this.wantlistRepository});

  final WantlistRepository wantlistRepository;

  int _page = 1;
  List<WantEntry> _entries = const [];
  bool _hasNext = false;
  bool _isLoading = true;
  bool _isRefreshing = false;
  bool _refreshFailed = false;
  bool _removeFailed = false;
  ApiException? _loadError;
  bool _listening = false;
  bool _disposed = false;
  int _generation = 0;

  int get page => _page;
  List<WantEntry> get entries => _entries;
  bool get hasNext => _hasNext;
  bool get hasPrevious => _page > 1;
  bool get isLoading => _isLoading;
  bool get isRefreshing => _isRefreshing;
  bool get refreshFailed => _refreshFailed;
  bool get removeFailed => _removeFailed;
  ApiException? get loadError => isGated ? null : _loadError;
  bool get isGated => _loadError?.code == 'discogs_not_linked' || needsRelink;
  bool get needsRelink => _loadError?.code == 'discogs_link_invalid';

  /// Loads (or retries) the current page.
  Future<void> load() {
    if (!_listening) {
      // Registered on first load, not in the constructor: a ViewModel the
      // router builds but the screen never uses holds no listener.
      wantlistRepository.addListener(_reloadSilently);
      _listening = true;
    }
    return _loadPage(_page);
  }

  Future<void> nextPage() => _loadPage(_page + 1);

  Future<void> previousPage() => _loadPage(_page - 1);

  Future<void> refresh() async {
    final generation = ++_generation;
    _isRefreshing = true;
    _refreshFailed = false;
    notifyListeners();
    try {
      final result = await wantlistRepository.list(page: _page, refresh: true);
      // A newer page or reload owns the list; only the button resets.
      if (generation == _generation) {
        _entries = result.items;
        _hasNext = result.hasMore;
      }
    } on ApiException {
      if (generation == _generation) _refreshFailed = true;
    }
    _isRefreshing = false;
    notifyListeners();
  }

  /// True when removed; the list then reloads through the repository.
  Future<bool> remove(int releaseId) async {
    _removeFailed = false;
    notifyListeners();
    try {
      await wantlistRepository.remove(releaseId);
      return true;
    } on ApiException {
      _removeFailed = true;
      notifyListeners();
      return false;
    }
  }

  Future<void> _loadPage(int page) async {
    final generation = ++_generation;
    _page = page;
    _isLoading = true;
    _loadError = null;
    _entries = const [];
    notifyListeners();
    try {
      final result = await wantlistRepository.list(page: page);
      if (generation != _generation) return;
      _entries = result.items;
      _hasNext = result.hasMore;
    } on ApiException catch (e) {
      if (generation != _generation) return;
      _loadError = e;
    }
    _isLoading = false;
    notifyListeners();
  }

  /// After a mutation: refetch this page without skeletons. A page emptied
  /// by a removal steps back to the previous one.
  Future<void> _reloadSilently() async {
    final generation = ++_generation;
    try {
      final result = await wantlistRepository.list(page: _page);
      if (generation != _generation) return;
      if (result.items.isEmpty && _page > 1) {
        await _loadPage(_page - 1);
        return;
      }
      _entries = result.items;
      _hasNext = result.hasMore;
      _isLoading = false;
      notifyListeners();
    } on ApiException catch (e) {
      // Cards stay; only a page load it superseded shows the error.
      if (generation != _generation || !_isLoading) return;
      _loadError = e;
      _isLoading = false;
      notifyListeners();
    }
  }

  @override
  void notifyListeners() {
    if (!_disposed) super.notifyListeners();
  }

  @override
  void dispose() {
    _disposed = true;
    _generation++;
    if (_listening) wantlistRepository.removeListener(_reloadSilently);
    super.dispose();
  }
}
