import 'package:material_ui/material_ui.dart';

import '../view_models/stats_view_model.dart';
import 'statistics_section.dart';
import 'statistics_skeleton.dart';
import 'stats_header.dart';
import 'stats_status_card.dart';
import 'valuation_section.dart';

/// Phones / narrow windows: one column, statistics then valuation.
class StatsCompactLayout extends StatelessWidget {
  const StatsCompactLayout({super.key, required this.viewModel});

  final StatsViewModel viewModel;

  @override
  Widget build(BuildContext context) {
    final vm = viewModel;
    final stats = vm.statistics;
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          StatsHeader(showIntro: vm.gate == null),
          const SizedBox(height: 24),
          if (vm.isLoadingStatistics)
            const StatisticsSkeleton(breakdownColumns: 1)
          else if (stats != null && !vm.isEmpty) ...[
            StatisticsSection(statistics: stats, breakdownColumns: 1),
            const SizedBox(height: 8),
            ValuationSection(viewModel: vm),
          ] else
            StatsStatusCard(viewModel: vm),
        ],
      ),
    );
  }
}
