import 'package:fake_async/fake_async.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:vinylmania/domain/api_exception.dart';
import 'package:vinylmania/domain/models/collection_stats/collection_valuation.dart';
import 'package:vinylmania/domain/models/collection_stats/valuation_chunk.dart';
import 'package:vinylmania/ui/stats/view_models/stats_view_model.dart';

import '../../../helpers/fakes/fake_collection_stats_repository.dart';
import '../../../helpers/fixtures/collection_stats_fixtures.dart';

import 'package:vinylmania/ui/stats/view_models/stats_gate.dart';
import 'package:vinylmania/ui/stats/view_models/valuation_status.dart';
import 'package:vinylmania/ui/stats/view_models/valuation_notice.dart';

ValuationChunk chunk(
  String status, {
  int covered = 0,
  int total = 100,
  int? next,
  int retryable = 0,
  double estimatedTotal = 0,
}) => ValuationChunk(
  valuation: CollectionValuation(
    currency: 'EUR',
    estimatedTotal: estimatedTotal,
    coveredCount: covered,
    totalCount: total,
    uncovered: (noMarketData: 0, noCondition: 0),
    topValuable: const [],
    status: status,
  ),
  status: status,
  nextCursor: next,
  pricedThisBatch: 0,
  fromCacheThisBatch: 0,
  retryable: retryable,
  perDisc: status == 'complete' ? completeValuationChunk.perDisc : null,
);

void main() {
  late FakeCollectionStatsRepository repo;
  late List<({int cursor, bool retryFailed})> calls;

  setUp(() {
    repo = FakeCollectionStatsRepository();
    calls = [];
  });

  void answer(List<Object> responses) {
    var i = 0;
    calls.clear();
    repo.onValuationChunk = (cursor, _, retryFailed) async {
      calls.add((cursor: cursor, retryFailed: retryFailed));
      final r = responses[i < responses.length - 1 ? i++ : i];
      if (r is ApiException) throw r;
      return r as ValuationChunk;
    };
  }

  group('statistics', () {
    test('starts loading, then exposes the statistics', () async {
      final vm = StatsViewModel(collectionStatsRepository: repo);
      expect(vm.isLoadingStatistics, isTrue);

      await vm.load();

      expect(vm.isLoadingStatistics, isFalse);
      expect(vm.statistics, same(collectionStatistics));
      expect(vm.isEmpty, isFalse);
      expect(vm.gate, isNull);
      expect(vm.hasStatisticsError, isFalse);
    });

    test(
      'discogs_not_linked / discogs_link_invalid → gate, no valuation',
      () async {
        for (final (code, gate) in [
          ('discogs_not_linked', StatsGate.notLinked),
          ('discogs_link_invalid', StatsGate.relink),
        ]) {
          repo.onStatistics = (_) async => throw ApiException(409, code, 'x');
          answer([completeValuationChunk]);
          final vm = StatsViewModel(collectionStatsRepository: repo);
          await vm.load();
          expect(vm.gate, gate);
          expect(vm.statistics, isNull);
          expect(calls, isEmpty);
        }
      },
    );

    test('other failure → error; retry reloads', () async {
      repo.onStatistics = (_) async =>
          throw const ApiException(500, 'internal_error', 'x');
      final vm = StatsViewModel(collectionStatsRepository: repo);
      await vm.load();
      expect(vm.hasStatisticsError, isTrue);
      expect(vm.gate, isNull);

      repo.onStatistics = (_) async => collectionStatistics;
      await vm.load();
      expect(vm.hasStatisticsError, isFalse);
      expect(vm.statistics, isNotNull);
    });

    test('empty collection → isEmpty, valuation never starts', () async {
      repo.onStatistics = (_) async => minimalCollectionStatistics;
      answer([completeValuationChunk]);
      final vm = StatsViewModel(collectionStatsRepository: repo);
      await vm.load();
      expect(vm.isEmpty, isTrue);
      expect(calls, isEmpty);
      expect(vm.valuationStatus, ValuationStatus.idle);
    });
  });

  group('valuation loop', () {
    test('follows nextCursor until complete, with progress', () async {
      answer([
        chunk('partial', covered: 25, next: 25),
        chunk('partial', covered: 50, next: 50),
        chunk('complete', covered: 100, retryable: 2, estimatedTotal: 300),
      ]);
      final vm = StatsViewModel(collectionStatsRepository: repo);
      final progress = <double>[];
      vm.addListener(() => progress.add(vm.progress));

      await vm.load();

      expect(calls.map((c) => c.cursor), [0, 25, 50]);
      expect(progress, containsAllInOrder([0.25, 0.5, 1.0]));
      expect(vm.valuationStatus, ValuationStatus.complete);
      expect(vm.valuation!.estimatedTotal, 300);
      expect(vm.perDisc, hasLength(2));
      expect(vm.retryable, 2);
      expect(vm.notice, isNull);
    });

    test('isLongRunning while partial with > 50 discs left', () {
      fakeAsync((async) {
        repo.onValuationChunk = (cursor, _, _) async {
          if (cursor == 0) return chunk('partial', covered: 25, next: 25);
          await Future<void>.delayed(const Duration(days: 1));
          return chunk('complete', covered: 100);
        };
        final vm = StatsViewModel(collectionStatsRepository: repo);
        vm.load();
        async.flushMicrotasks();
        expect(vm.valuationStatus, ValuationStatus.partial);
        expect(vm.isLongRunning, isTrue);
        vm.dispose();
      });
    });

    test('transient unavailable retries the same cursor with backoff ×3', () {
      fakeAsync((async) {
        answer([
          chunk('partial', covered: 25, next: 25),
          chunk('unavailable', covered: 25),
          chunk('unavailable', covered: 25),
          chunk('complete', covered: 100),
        ]);
        final vm = StatsViewModel(collectionStatsRepository: repo);
        vm.load();
        async.flushMicrotasks();
        expect(calls.map((c) => c.cursor), [0, 25]);
        expect(vm.notice, ValuationNotice.unavailable);
        expect(vm.valuationStatus, ValuationStatus.partial);

        async.elapse(const Duration(milliseconds: 1499));
        expect(calls, hasLength(2));
        async.elapse(const Duration(milliseconds: 1));
        expect(calls.map((c) => c.cursor), [0, 25, 25]);

        async.elapse(const Duration(milliseconds: 3000)); // 1.5 s × 2
        expect(calls.map((c) => c.cursor), [0, 25, 25, 25]);
        expect(vm.valuationStatus, ValuationStatus.complete);
        expect(vm.notice, isNull);
      });
    });

    test('gives up after 3 transient retries', () {
      fakeAsync((async) {
        answer([chunk('unavailable')]);
        final vm = StatsViewModel(collectionStatsRepository: repo);
        vm.load();
        async.elapse(const Duration(minutes: 1));
        expect(calls, hasLength(4));
        expect(vm.notice, ValuationNotice.unavailable);
        expect(vm.valuationStatus, ValuationStatus.unavailable);
      });
    });

    test('seller_settings_required → seller-settings notice', () async {
      answer([const ApiException(422, 'seller_settings_required', 'x')]);
      final vm = StatsViewModel(collectionStatsRepository: repo);
      await vm.load();
      expect(vm.notice, ValuationNotice.sellerSettings);
      expect(vm.valuationStatus, ValuationStatus.unavailable);
      expect(vm.statistics, isNotNull);
    });

    test('other failure keeps the running total as partial', () async {
      answer([
        chunk('partial', covered: 25, next: 25, estimatedTotal: 50),
        const ApiException(0, 'network_error', 'x'),
      ]);
      final vm = StatsViewModel(collectionStatsRepository: repo);
      await vm.load();
      expect(vm.notice, ValuationNotice.unavailable);
      expect(vm.valuationStatus, ValuationStatus.partial);
      expect(vm.valuation!.estimatedTotal, 50);
    });

    test(
      'retryValuation starts over from cursor 0 with a clean state',
      () async {
        answer([const ApiException(0, 'network_error', 'x')]);
        final vm = StatsViewModel(collectionStatsRepository: repo);
        await vm.load();
        expect(vm.notice, ValuationNotice.unavailable);

        answer([chunk('complete', covered: 100)]);
        final retried = vm.retryValuation();
        expect(vm.notice, isNull);
        expect(vm.valuation, isNull);
        await retried;
        expect(calls.single.cursor, 0);
        expect(calls.single.retryFailed, isFalse);
        expect(vm.valuationStatus, ValuationStatus.complete);
      },
    );

    test('retryFailedDiscs keeps the total and asks retry=failed', () async {
      answer([
        chunk('complete', covered: 98, retryable: 2, estimatedTotal: 90),
      ]);
      final vm = StatsViewModel(collectionStatsRepository: repo);
      await vm.load();

      answer([chunk('complete', covered: 100, estimatedTotal: 95)]);
      final retried = vm.retryFailedDiscs();
      expect(vm.valuation!.estimatedTotal, 90);
      expect(vm.valuationStatus, ValuationStatus.partial);
      await retried;
      expect(calls.single, (cursor: 0, retryFailed: true));
      expect(vm.valuation!.estimatedTotal, 95);
      expect(vm.retryable, 0);
    });

    test('cancelled on dispose: no more chunks, no notifications', () {
      fakeAsync((async) {
        answer([chunk('unavailable')]);
        final vm = StatsViewModel(collectionStatsRepository: repo);
        vm.load();
        async.flushMicrotasks();
        expect(calls, hasLength(1));

        vm.dispose();
        async.elapse(const Duration(minutes: 1));
        expect(calls, hasLength(1));
      });
    });
  });
}
