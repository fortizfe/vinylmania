import 'package:material_ui/material_ui.dart';

import '../../core/widgets/skeleton.dart';
import 'statistics_section.dart';

/// Placeholder in the shape of [StatisticsSection] (web `StatsSkeleton`).
class StatisticsSkeleton extends StatelessWidget {
  const StatisticsSkeleton({super.key, required this.breakdownColumns});

  final int breakdownColumns;

  @override
  Widget build(BuildContext context) {
    // Totals card: padding + label, name and count lines of its widest
    // column. ponytail: the card wraps to two runs on narrow widths with long
    // labels; that case still grows on load.
    final totals = 32 + MediaQuery.textScalerOf(context).scale(64);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Skeleton(width: 200, height: 24),
        const SizedBox(height: 16),
        Skeleton(height: totals),
        const SizedBox(height: 24),
        ...gridRows(
          List.generate(4, (_) => const Skeleton(height: 176)),
          breakdownColumns,
        ),
        const Skeleton(height: 160),
        const SizedBox(height: 24),
        const Skeleton(height: 224),
      ],
    );
  }
}
