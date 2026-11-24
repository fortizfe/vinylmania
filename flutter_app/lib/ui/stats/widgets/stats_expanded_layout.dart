import 'package:material_ui/material_ui.dart';

import '../../core/widgets/skeleton.dart';
import '../view_models/stats_view_model.dart';
import 'statistics_section.dart';
import 'statistics_skeleton.dart';
import 'stats_header.dart';
import 'stats_status_card.dart';
import 'valuation_section.dart';

/// Tablets / desktop: statistics (2-column breakdowns) beside the valuation.
class StatsExpandedLayout extends StatelessWidget {
  const StatsExpandedLayout({super.key, required this.viewModel});

  final StatsViewModel viewModel;

  @override
  Widget build(BuildContext context) {
    final vm = viewModel;
    final stats = vm.statistics;
    final populated = stats != null && !vm.isEmpty;
    return SingleChildScrollView(
      padding: const EdgeInsets.all(32),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          StatsHeader(showIntro: vm.gate == null),
          const SizedBox(height: 32),
          if (vm.isLoadingStatistics || populated)
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  flex: 3,
                  child: populated
                      ? StatisticsSection(
                          statistics: stats,
                          breakdownColumns: 2,
                        )
                      : const StatisticsSkeleton(breakdownColumns: 2),
                ),
                const SizedBox(width: 32),
                Expanded(
                  flex: 2,
                  child: populated
                      ? ValuationSection(viewModel: vm)
                      : const Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            Skeleton(width: 200, height: 24),
                            SizedBox(height: 16),
                            Skeleton(height: 160),
                          ],
                        ),
                ),
              ],
            )
          else
            Align(
              alignment: Alignment.topLeft,
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 720),
                child: StatsStatusCard(viewModel: vm),
              ),
            ),
        ],
      ),
    );
  }
}
