import '../../domain/models/feeds/feeds_dashboard.dart';
import '../../domain/models/feeds/source_feed.dart';
import '../services/feeds_api.dart';

/// Music news. Throws `ApiException`.
class FeedsRepository {
  FeedsRepository({required this._api});

  final FeedsApi _api;

  Future<FeedsDashboard> dashboard() => _api.dashboard();

  Future<SourceFeed> source(String sourceId) => _api.source(sourceId);
}
