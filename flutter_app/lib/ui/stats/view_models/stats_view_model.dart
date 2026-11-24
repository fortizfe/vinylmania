import 'package:flutter/foundation.dart';

import '../../../data/repositories/collection_stats_repository.dart';
import '../../../domain/api_exception.dart';
import '../../../domain/models/collection_stats/collection_statistics.dart';
import '../../../domain/models/collection_stats/collection_valuation.dart';
import '../../../domain/models/collection_stats/per_disc_value.dart';
import '../../../domain/models/collection_stats/valuation_chunk.dart';
import 'stats_gate.dart';
import 'valuation_status.dart';
import 'valuation_notice.dart';

/// Collection stats screen: the statistics, then the progressive valuation
/// (port of the web's `useProgressiveValuation`).
// ponytail: no snapshot of the running total across visits (the web keeps it
// in the query cache); the loop restarts at cursor 0 on every visit, which is
// cheap server-side. Keep it in the repository if the flash of 0 bothers.
class StatsViewModel extends ChangeNotifier {
  StatsViewModel({required this.collectionStatsRepository});

  final CollectionStatsRepository collectionStatsRepository;

  static const backoff = Duration(milliseconds: 1500);
  static const maxTransientRetries = 3;

  /// Unpriced discs past which the "come back later" note shows (≈ 2 batches).
  static const longRunningRemaining = 50;

  bool _isLoadingStatistics = true;
  CollectionStatistics? _statistics;
  StatsGate? _gate;
  bool _hasStatisticsError = false;

  CollectionValuation? _valuation;
  List<PerDiscValue>? _perDisc;
  ValuationNotice? _notice;
  ValuationStatus _valuationStatus = ValuationStatus.idle;
  int _retryable = 0;

  int _runId = 0;
  bool _disposed = false;

  bool get isLoadingStatistics => _isLoadingStatistics;
  CollectionStatistics? get statistics => _statistics;
  StatsGate? get gate => _gate;
  bool get hasStatisticsError => _hasStatisticsError;
  bool get isEmpty => _statistics?.totalRecords == 0;

  CollectionValuation? get valuation => _valuation;

  /// Full per-disc list, only once the valuation is complete.
  List<PerDiscValue>? get perDisc => _perDisc;
  ValuationNotice? get notice => _notice;
  ValuationStatus get valuationStatus => _valuationStatus;

  /// Discs that failed transiently and can be re-priced on their own.
  int get retryable => _retryable;

  bool get isComputing =>
      _valuationStatus == ValuationStatus.loading ||
      _valuationStatus == ValuationStatus.partial;

  /// Fraction in [0, 1] of discs attempted so far.
  double get progress {
    if (_valuationStatus == ValuationStatus.complete) return 1;
    final v = _valuation;
    if (v == null || v.totalCount == 0) return 0;
    return (_attempted(v) / v.totalCount).clamp(0, 1).toDouble();
  }

  bool get isLongRunning {
    final v = _valuation;
    return _valuationStatus == ValuationStatus.partial &&
        v != null &&
        v.totalCount - _attempted(v) > longRunningRemaining;
  }

  /// Loads the statistics and, for a non-empty collection, runs the
  /// valuation to its end.
  Future<void> load() async {
    _isLoadingStatistics = true;
    _hasStatisticsError = false;
    _gate = null;
    _notify();
    try {
      _statistics = await collectionStatsRepository.statistics();
    } on ApiException catch (e) {
      _gate = switch (e.code) {
        'discogs_not_linked' => StatsGate.notLinked,
        'discogs_link_invalid' => StatsGate.relink,
        _ => null,
      };
      _hasStatisticsError = _gate == null;
    }
    _isLoadingStatistics = false;
    _notify();
    if ((_statistics?.totalRecords ?? 0) > 0) await _run(retryFailed: false);
  }

  /// Discards the running total and prices the whole collection again.
  Future<void> retryValuation() {
    _valuation = null;
    _perDisc = null;
    _retryable = 0;
    return _run(retryFailed: false);
  }

  /// Keeps the total on screen and re-prices only the failed discs.
  Future<void> retryFailedDiscs() => _run(retryFailed: true);

  Future<void> _run({required bool retryFailed}) async {
    final runId = ++_runId;
    bool cancelled() => _disposed || runId != _runId;

    _notice = null;
    _perDisc = null;
    _valuationStatus = _valuation == null
        ? ValuationStatus.loading
        : ValuationStatus.partial;
    _notify();

    var cursor = 0;
    var transientRetries = 0;
    while (true) {
      final ValuationChunk chunk;
      try {
        chunk = await collectionStatsRepository.valuationChunk(
          cursor: cursor,
          retryFailed: retryFailed,
        );
      } on Exception catch (e) {
        if (cancelled()) return;
        final sellerSettings =
            e is ApiException && e.code == 'seller_settings_required';
        _notice = sellerSettings
            ? ValuationNotice.sellerSettings
            : ValuationNotice.unavailable;
        _valuationStatus = !sellerSettings && _valuation != null
            ? ValuationStatus.partial
            : ValuationStatus.unavailable;
        _notify();
        return;
      }
      if (cancelled()) return;

      if (chunk.status == 'unavailable') {
        _valuation = chunk.valuation;
        _notice = ValuationNotice.unavailable;
        _valuationStatus = _attempted(chunk.valuation) > 0
            ? ValuationStatus.partial
            : ValuationStatus.unavailable;
        _notify();
        if (transientRetries == maxTransientRetries) return;
        transientRetries++;
        await Future<void>.delayed(backoff * transientRetries);
        if (cancelled()) return;
        continue; // same cursor
      }

      transientRetries = 0;
      final done = chunk.status == 'complete';
      _valuation = chunk.valuation;
      _retryable = chunk.retryable;
      _perDisc = done ? chunk.perDisc : null;
      _notice = null;
      _valuationStatus = done
          ? ValuationStatus.complete
          : ValuationStatus.partial;
      _notify();
      final next = chunk.nextCursor;
      if (done || next == null) return;
      cursor = next;
    }
  }

  static int _attempted(CollectionValuation v) =>
      v.coveredCount + v.uncovered.noMarketData + v.uncovered.noCondition;

  void _notify() {
    if (!_disposed) notifyListeners();
  }

  @override
  void dispose() {
    _disposed = true;
    super.dispose();
  }
}
