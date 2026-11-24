import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';
import 'package:vinylmania/domain/api_exception.dart';
import 'package:vinylmania/domain/models/collection_stats/collection_statistics.dart';
import 'package:vinylmania/domain/models/collection_stats/valuation_chunk.dart';
import 'package:vinylmania/ui/core/widgets/discogs_link_gate.dart';
import 'package:vinylmania/ui/core/widgets/skeleton.dart';
import 'package:vinylmania/ui/stats/view_models/stats_view_model.dart';
import 'package:vinylmania/ui/stats/widgets/growth_chart_card.dart';
import 'package:vinylmania/ui/stats/widgets/stat_breakdown_card.dart';
import 'package:vinylmania/ui/stats/widgets/valuation_card.dart';
import 'package:vinylmania/ui/stats/widgets/stats_compact_layout.dart';
import 'package:vinylmania/ui/stats/widgets/stats_expanded_layout.dart';
import 'package:vinylmania/ui/stats/widgets/stats_screen.dart';

import '../../../helpers/fakes/fake_collection_stats_repository.dart';
import '../../../helpers/fixtures/collection_stats_fixtures.dart';
import '../../../helpers/pump_screen.dart';

import 'package:vinylmania/ui/stats/widgets/collection_totals_card.dart';
import 'package:vinylmania/ui/stats/widgets/statistics_skeleton.dart';

const growthSummary =
    'Collection growth by month: 4 records added between Apr 2024 and May '
    '2024, reaching a cumulative total of 39.';

void main() {
  late FakeCollectionStatsRepository repo;

  setUp(() => repo = FakeCollectionStatsRepository());

  Future<void> pump(
    WidgetTester tester, {
    Size size = compactSize,
    ThemeMode mode = ThemeMode.light,
    double textScale = 1,
    bool disableAnimations = false,
  }) async {
    await pumpScreen(
      tester,
      StatsScreen(
        createViewModel: () => StatsViewModel(collectionStatsRepository: repo),
      ),
      size: size,
      mode: mode,
      textScale: textScale,
      disableAnimations: disableAnimations,
    );
    await tester.pump();
  }

  for (final (size, layout) in [
    (compactSize, StatsCompactLayout),
    (expandedSize, StatsExpandedLayout),
  ]) {
    testWidgets('$layout: skeleton while the statistics load', (tester) async {
      final pending = Completer<CollectionStatistics>();
      repo.onStatistics = (_) => pending.future;
      await pump(tester, size: size);

      expect(find.byType(layout), findsOneWidget);
      expect(find.text('Mi colección en cifras'), findsOneWidget);
      expect(find.byType(Skeleton), findsWidgets);
      expect(find.byType(CircularProgressIndicator), findsNothing);
      // Heading, then the totals placeholder.
      final totals = tester.getRect(
        find
            .descendant(
              of: find.byType(StatisticsSkeleton),
              matching: find.byType(Skeleton),
            )
            .at(1),
      );
      pending.complete(collectionStatistics);
      await tester.pump(const Duration(seconds: 1));
      final loaded = tester.getRect(find.byType(CollectionTotalsCard));
      const reason = 'no layout shift between skeleton and loaded';
      expect(loaded.topLeft, totals.topLeft, reason: reason);
      expect(loaded.width, totals.width, reason: reason);
      // Compact wraps the totals into two runs (test font); both must match.
      expect(loaded.height, totals.height, reason: reason);
    });

    for (final mode in [ThemeMode.light, ThemeMode.dark]) {
      testWidgets('$layout: statistics and valuation ($mode)', (tester) async {
        await pump(tester, size: size, mode: mode);

        expect(find.byType(layout), findsOneWidget);
        expect(find.text('Records in your collection'), findsOneWidget);
        expect(find.text('39'), findsOneWidget);
        expect(find.text('Most-present artist'), findsOneWidget);
        for (final title in ['By decade', 'By genre', 'By style', 'By label']) {
          expect(find.text(title), findsOneWidget);
        }
        expect(find.text('Top artists'), findsOneWidget);
        expect(find.text('Growth over time'), findsOneWidget);
        expect(find.text('Total estimated value'), findsOneWidget);
        expect(find.text('€120.00'), findsOneWidget);
        expect(find.text('estimado sobre 3 de 5 discos'), findsOneWidget);
        expect(find.text('Most valuable records'), findsOneWidget);
        expect(find.text('Master Of Puppets'), findsOneWidget);
        await expectA11yGuidelines(tester);
      });
    }

    testWidgets('$layout: no overflow at text scale 2.0', (tester) async {
      await pump(tester, size: size, textScale: 2);
      expect(tester.takeException(), isNull);
    });
  }

  testWidgets('reduced motion: bars, chevrons, totals and chart are instant', (
    tester,
  ) async {
    await pump(tester, disableAnimations: true);
    expectInstantMotion(
      find.byWidgetPredicate(
        (w) =>
            w is StatBreakdownCard ||
            w is ValuationCard ||
            w is GrowthChartCard,
      ),
    );
    // The chart draws complete on its first frame instead of growing in.
    expect(
      tester
          .widget<TweenAnimationBuilder<double>>(
            find.byType(TweenAnimationBuilder<double>),
          )
          .tween
          .begin,
      1,
    );
  });

  testWidgets('"Otros" discloses the hidden remainder', (tester) async {
    await pump(tester);
    final others = find.text('Otros (4)').first;
    await tester.ensureVisible(others);
    expect(find.text('2 more values, 4 records combined.'), findsNothing);

    await tester.tap(others);
    await tester.pump();

    expect(find.text('2 more values, 4 records combined.'), findsOneWidget);
  });

  testWidgets('top artists are ranked with the most-present call-out', (
    tester,
  ) async {
    await pump(tester);
    expect(find.text('Most present'), findsOneWidget);
    expect(find.text('Slayer'), findsOneWidget);
  });

  testWidgets('growth chart: summary for screen readers + series toggle', (
    tester,
  ) async {
    await pump(tester);
    expect(find.bySemanticsLabel(growthSummary), findsOneWidget);

    final cumulative = find.text('Cumulative');
    await tester.ensureVisible(cumulative);
    await tester.tap(cumulative);
    await tester.pump(const Duration(seconds: 1));
    expect(
      tester.getSemantics(find.bySemanticsLabel('Cumulative')),
      isSemantics(isSelected: true, isButton: true, hasTapAction: true),
    );
  });

  testWidgets('"Ver todos" opens the per-disc breakdown', (tester) async {
    await pump(tester);
    final button = find.text('Ver todos');
    await tester.ensureVisible(button);
    await tester.tap(button);
    await tester.pumpAndSettle();

    expect(find.text('Per-disc breakdown'), findsOneWidget);
    expect(find.text('Untitled'), findsOneWidget);
    expect(find.text('sin estado'), findsOneWidget);
    expect(find.text('€45.50'), findsWidgets);
  });

  testWidgets('retryable discs offer a retry of only those', (tester) async {
    final retried = <bool>[];
    repo.onValuationChunk = (_, _, retryFailed) async {
      retried.add(retryFailed);
      return completeValuationChunk;
    };
    await pump(tester);
    expect(
      find.text(
        'No pudimos consultar el precio de 1 disco. Puedes reintentarlo sin '
        'repetir toda la valoración.',
      ),
      findsOneWidget,
    );
    final button = find.text('Reintentar esos discos');
    await tester.ensureVisible(button);
    await tester.tap(button);
    await tester.pump();
    expect(retried, [false, true]);
  });

  testWidgets('valuation in progress shows a labelled progress bar', (
    tester,
  ) async {
    final pending = Completer<ValuationChunk>();
    repo.onValuationChunk = (cursor, _, _) async =>
        cursor == 0 ? partialValuationChunk : pending.future;
    await pump(tester);

    expect(find.bySemanticsLabel('Progreso de la valoración'), findsOneWidget);
    pending.complete(completeValuationChunk);
    await tester.pump();
    expect(find.bySemanticsLabel('Progreso de la valoración'), findsNothing);
  });

  testWidgets('seller settings notice replaces the valuation', (tester) async {
    repo.onValuationChunk = (_, _, _) async =>
        throw const ApiException(422, 'seller_settings_required', 'x');
    await pump(tester);
    expect(
      find.text('Estimated value needs your Discogs seller settings'),
      findsOneWidget,
    );
    expect(find.text('Try the valuation again'), findsNothing);
    expect(find.text('Total estimated value'), findsNothing);
  });

  testWidgets('unavailable notice retries the whole valuation', (tester) async {
    var calls = 0;
    repo.onValuationChunk = (_, _, _) async {
      calls++;
      if (calls == 1) throw const ApiException(0, 'network_error', 'x');
      return completeValuationChunk;
    };
    await pump(tester);
    expect(
      find.text("We couldn't estimate your collection's value right now"),
      findsOneWidget,
    );
    final retry = find.text('Try the valuation again');
    await tester.ensureVisible(retry);
    await tester.tap(retry);
    await tester.pump();
    expect(find.text('€120.00'), findsOneWidget);
  });

  testWidgets('not linked → the Discogs gate only', (tester) async {
    repo.onStatistics = (_) async =>
        throw const ApiException(409, 'discogs_not_linked', 'x');
    await pump(tester);
    expect(find.byType(DiscogsLinkGate), findsOneWidget);
    expect(find.text('Link your Discogs account'), findsOneWidget);
    expect(find.text('Total estimated value'), findsNothing);
    await expectA11yGuidelines(tester);
  });

  testWidgets('error → message and a working Retry', (tester) async {
    repo.onStatistics = (_) async =>
        throw const ApiException(500, 'internal_error', 'x');
    await pump(tester);
    expect(
      find.text(
        'Something went wrong while loading your collection stats. Please try '
        'again.',
      ),
      findsOneWidget,
    );

    repo.onStatistics = (_) async => collectionStatistics;
    await tester.tap(find.text('Retry'));
    await tester.pump();
    await tester.pump();
    expect(find.text('Records in your collection'), findsOneWidget);
  });

  testWidgets('empty collection → empty message, no valuation', (tester) async {
    repo.onStatistics = (_) async => minimalCollectionStatistics;
    await pump(tester);
    expect(
      find.text(
        "Your Discogs collection has no records yet. Add some records on "
        "Discogs and they'll show up here.",
      ),
      findsOneWidget,
    );
    expect(find.text('Total estimated value'), findsNothing);
  });
}
