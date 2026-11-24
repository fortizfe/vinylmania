import '../../domain/models/feeds/feeds_dashboard.dart';
import '../../domain/models/feeds/source_feed.dart';
import 'api_client.dart';

/// `/api/feeds/*` calls.
class FeedsApi {
  FeedsApi(this._client);

  final ApiClient _client;

  Future<FeedsDashboard> dashboard() async => FeedsDashboard.fromJson(
    await _client.get('/api/feeds/dashboard') as Map<String, Object?>,
  );

  Future<SourceFeed> source(String sourceId) async => SourceFeed.fromJson(
    await _client.get('/api/feeds/sources/${Uri.encodeComponent(sourceId)}')
        as Map<String, Object?>,
  );
}
