import 'package:material_ui/material_ui.dart';

import '../../../domain/models/collection_stats/collection_statistics.dart';
import 'collection_totals_card.dart';
import 'growth_chart_card.dart';
import 'stat_breakdown_card.dart';
import 'stats_heading.dart';
import 'top_artists_card.dart';

/// "Collection statistics": totals, the four breakdowns in
/// [breakdownColumns] columns, top artists and the growth chart.
class StatisticsSection extends StatelessWidget {
  const StatisticsSection({
    super.key,
    required this.statistics,
    required this.breakdownColumns,
  });

  final CollectionStatistics statistics;
  final int breakdownColumns;

  @override
  Widget build(BuildContext context) {
    final s = statistics;
    final breakdowns = [
      StatBreakdownCard(title: 'By decade', breakdown: s.byDecade),
      StatBreakdownCard(title: 'By genre', breakdown: s.byGenre),
      StatBreakdownCard(title: 'By style', breakdown: s.byStyle),
      StatBreakdownCard(title: 'By label', breakdown: s.byLabel),
    ];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const StatsHeading('Collection statistics'),
        const SizedBox(height: 16),
        CollectionTotalsCard(
          totalRecords: s.totalRecords,
          mostPresentArtist: s.mostPresentArtist,
        ),
        const SizedBox(height: 24),
        ...gridRows(breakdowns, breakdownColumns),
        TopArtistsCard(artists: s.topArtists, mostPresent: s.mostPresentArtist),
        const SizedBox(height: 24),
        GrowthChartCard(points: s.growth),
      ],
    );
  }
}

/// [children] in rows of [columns], each row followed by a 24 px gap.
List<Widget> gridRows(List<Widget> children, int columns) => [
  for (var i = 0; i < children.length; i += columns) ...[
    Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (var j = i; j < i + columns && j < children.length; j++) ...[
          if (j > i) const SizedBox(width: 24),
          Expanded(child: children[j]),
        ],
      ],
    ),
    const SizedBox(height: 24),
  ],
];
