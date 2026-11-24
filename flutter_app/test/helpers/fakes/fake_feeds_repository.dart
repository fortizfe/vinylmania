import 'package:vinylmania/data/repositories/feeds_repository.dart';
import 'package:vinylmania/domain/models/feeds/feeds_dashboard.dart';
import 'package:vinylmania/domain/models/feeds/source_feed.dart';

import '../fixtures/feeds_fixtures.dart';

/// Each call is answered by its `onX` handler (defaults: fixtures).
class FakeFeedsRepository implements FeedsRepository {
  Future<FeedsDashboard> Function() onDashboard = () async => feedsDashboard;
  Future<SourceFeed> Function(String sourceId) onSource = (_) async =>
      sourceFeed;

  @override
  Future<FeedsDashboard> dashboard() => onDashboard();

  @override
  Future<SourceFeed> source(String sourceId) => onSource(sourceId);
}
