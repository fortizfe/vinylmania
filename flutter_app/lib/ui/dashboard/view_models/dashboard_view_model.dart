import 'package:flutter/foundation.dart';

import '../../../data/repositories/feeds_repository.dart';
import '../../../domain/models/feeds/article.dart';
import '../../../domain/models/feeds/feeds_dashboard.dart';
import '../../../domain/models/feeds/source_feed.dart';
import '../../../domain/models/feeds/source_status.dart';
import 'dashboard_status.dart';
import 'portada_slots.dart';

/// News dashboard (web `DashboardPage` + `FeedArticleBoard`): every source's
/// articles on one front page, or one source's feed when its chip is selected.
class DashboardViewModel extends ChangeNotifier {
  DashboardViewModel({required this.feedsRepository});

  final FeedsRepository feedsRepository;

  FeedsDashboard? _dashboard;
  SourceFeed? _sourceFeed;
  String? _selectedSourceId;
  bool _loading = true;
  bool _failed = false;
  bool _disposed = false;

  /// Selected source chip; null is "All sources".
  String? get selectedSourceId => _selectedSourceId;

  /// Priority sources first, each group in backend order.
  List<SourceStatus> get sources {
    final all = _dashboard?.sourceStatuses ?? const <SourceStatus>[];
    return [...all.where((s) => s.priority), ...all.where((s) => !s.priority)];
  }

  DashboardStatus get status {
    if (_loading) return DashboardStatus.loading;
    if (_failed) return DashboardStatus.error;
    final statuses = _dashboard!.sourceStatuses;
    if (statuses.isNotEmpty && statuses.every((s) => !s.isAvailable)) {
      return DashboardStatus.allUnavailable;
    }
    if (_sourceFeed?.isAvailable == false) {
      return DashboardStatus.sourceUnavailable;
    }
    return _articles.isEmpty ? DashboardStatus.empty : DashboardStatus.ready;
  }

  String? get unavailableSourceName => _sourceFeed?.sourceName;

  /// The front page of every source's articles (categories merged, as the
  /// web), or of the selected source's feed.
  PortadaSlots get slots => assignPortadaSlots(_articles);

  List<Article> get _articles =>
      _sourceFeed?.articles ??
      [for (final g in _dashboard?.categories ?? const []) ...g.articles];

  Future<void> load() async {
    _start();
    try {
      _dashboard = await feedsRepository.dashboard();
      _sourceFeed = null;
      _selectedSourceId = null;
    } on Exception {
      _failed = true;
    }
    _loading = false;
    notifyListeners();
  }

  Future<void> selectSource(String? sourceId) async {
    _selectedSourceId = sourceId;
    _sourceFeed = null;
    if (sourceId == null) {
      _failed = false;
      _loading = false;
      notifyListeners();
      return;
    }
    _start();
    try {
      final feed = await feedsRepository.source(sourceId);
      if (_selectedSourceId != sourceId) return;
      _sourceFeed = feed;
    } on Exception {
      if (_selectedSourceId != sourceId) return;
      _failed = true;
    }
    _loading = false;
    notifyListeners();
  }

  Future<void> retry() =>
      _dashboard == null ? load() : selectSource(_selectedSourceId);

  @override
  void notifyListeners() {
    if (!_disposed) super.notifyListeners();
  }

  @override
  void dispose() {
    _disposed = true;
    super.dispose();
  }

  void _start() {
    _loading = true;
    _failed = false;
    notifyListeners();
  }
}
