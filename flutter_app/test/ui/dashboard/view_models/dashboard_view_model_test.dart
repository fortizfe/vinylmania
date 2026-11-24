import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:vinylmania/domain/api_exception.dart';
import 'package:vinylmania/domain/models/feeds/feeds_dashboard.dart';
import 'package:vinylmania/domain/models/feeds/source_feed.dart';
import 'package:vinylmania/ui/dashboard/view_models/dashboard_status.dart';
import 'package:vinylmania/ui/dashboard/view_models/dashboard_view_model.dart';

import '../../../helpers/fakes/fake_feeds_repository.dart';
import '../../../helpers/fixtures/feeds_fixtures.dart';

const _error = ApiException(503, 'unavailable', 'down');

FeedsDashboard _dashboardWith(List<Map<String, Object?>> statuses) =>
    FeedsDashboard.fromJson({...dashboardJson, 'sourceStatuses': statuses});

void main() {
  late FakeFeedsRepository repository;
  late DashboardViewModel viewModel;

  setUp(() {
    repository = FakeFeedsRepository();
    viewModel = DashboardViewModel(feedsRepository: repository);
  });

  test('starts loading and lays out all articles once loaded', () async {
    expect(viewModel.status, DashboardStatus.loading);

    await viewModel.load();

    expect(viewModel.status, DashboardStatus.ready);
    expect(viewModel.slots.lead?.id, 'a1');
    expect([for (final a in viewModel.slots.latest) a.id], ['a2']);
    expect(viewModel.selectedSourceId, isNull);
  });

  test('orders sources priority first, keeping the backend order', () async {
    repository.onDashboard = () async => _dashboardWith([
      for (final (id, priority) in [
        ('a', false),
        ('b', true),
        ('c', false),
        ('d', true),
      ])
        {
          'sourceId': id,
          'sourceName': id.toUpperCase(),
          'status': 'ok',
          'priority': priority,
        },
    ]);

    await viewModel.load();

    expect(viewModel.sources.map((s) => s.sourceId), ['b', 'd', 'a', 'c']);
  });

  test('empty when no source has articles', () async {
    repository.onDashboard = () async => minimalFeedsDashboard;

    await viewModel.load();

    expect(viewModel.status, DashboardStatus.empty);
  });

  test('all unavailable when every source is down', () async {
    repository.onDashboard = () async => _dashboardWith([
      {
        'sourceId': 'a',
        'sourceName': 'A',
        'status': 'unavailable',
        'priority': false,
      },
    ]);

    await viewModel.load();

    expect(viewModel.status, DashboardStatus.allUnavailable);
  });

  test('selecting a source loads its feed into the front page', () async {
    final requested = <String>[];
    repository.onSource = (id) async {
      requested.add(id);
      return sourceFeed;
    };
    await viewModel.load();

    final pending = viewModel.selectSource('metal-hammer');
    expect(viewModel.status, DashboardStatus.loading);
    await pending;

    expect(requested, ['metal-hammer']);
    expect(viewModel.selectedSourceId, 'metal-hammer');
    expect(viewModel.status, DashboardStatus.ready);
    expect(viewModel.slots.lead?.id, 'a1');
    expect(viewModel.slots.latest, isEmpty);
  });

  test('a source that is down is reported by name', () async {
    repository.onSource = (_) async => minimalSourceFeed;
    await viewModel.load();

    await viewModel.selectSource('rolling-stone');

    expect(viewModel.status, DashboardStatus.sourceUnavailable);
    expect(viewModel.unavailableSourceName, 'Rolling Stone');
  });

  test('"All sources" returns to the dashboard without a request', () async {
    var calls = 0;
    repository.onSource = (_) async {
      calls++;
      return sourceFeed;
    };
    await viewModel.load();
    await viewModel.selectSource('metal-hammer');

    await viewModel.selectSource(null);

    expect(calls, 1);
    expect(viewModel.selectedSourceId, isNull);
    expect(viewModel.slots.lead?.id, 'a1');
    expect([for (final a in viewModel.slots.latest) a.id], ['a2']);
  });

  test('a late answer for a previous source is ignored', () async {
    final slow = Completer<SourceFeed>();
    repository.onSource = (id) =>
        id == 'metal-hammer' ? slow.future : Future.value(minimalSourceFeed);
    await viewModel.load();

    final first = viewModel.selectSource('metal-hammer');
    await viewModel.selectSource('rolling-stone');
    slow.complete(sourceFeed);
    await first;

    expect(viewModel.selectedSourceId, 'rolling-stone');
    expect(viewModel.status, DashboardStatus.sourceUnavailable);
  });

  test('dashboard error, then retry loads it', () async {
    repository.onDashboard = () async => throw _error;
    await viewModel.load();
    expect(viewModel.status, DashboardStatus.error);

    repository.onDashboard = () async => feedsDashboard;
    await viewModel.retry();

    expect(viewModel.status, DashboardStatus.ready);
  });

  test('source error, then retry reloads that source', () async {
    await viewModel.load();
    repository.onSource = (_) async => throw _error;
    await viewModel.selectSource('metal-hammer');
    expect(viewModel.status, DashboardStatus.error);

    repository.onSource = (_) async => sourceFeed;
    await viewModel.retry();

    expect(viewModel.selectedSourceId, 'metal-hammer');
    expect(viewModel.status, DashboardStatus.ready);
  });

  test('notifies listeners on every state change', () async {
    var notified = 0;
    viewModel.addListener(() => notified++);

    await viewModel.load();

    expect(notified, greaterThanOrEqualTo(1));
  });
}
