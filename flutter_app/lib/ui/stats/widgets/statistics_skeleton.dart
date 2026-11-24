import 'package:material_ui/material_ui.dart';

import '../../../domain/models/collection_stats/artist_count.dart';
import '../../core/widgets/skeleton.dart';
import 'collection_totals_card.dart';
import 'statistics_section.dart';

/// Placeholder in the shape of [StatisticsSection] (web `StatsSkeleton`).
class StatisticsSkeleton extends StatelessWidget {
  const StatisticsSkeleton({super.key, required this.breakdownColumns});

  final int breakdownColumns;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Skeleton(width: 200, height: 24),
        const SizedBox(height: 16),
        // The real card, unpainted, sizes the placeholder: same labels, same
        // wrap and text scaling as the loaded totals. ponytail: an artist name
        // wider than its labels can still re-wrap; reserve from the last
        // loaded statistics if that shift is reported.
        const Stack(
          children: [
            Opacity(
              opacity: 0,
              child: CollectionTotalsCard(
                totalRecords: 0,
                mostPresentArtist: ArtistCount(name: 'Artist', count: 0),
              ),
            ),
            Positioned.fill(
              child: Skeleton(
                height: double.infinity,
                radius: BorderRadius.all(Radius.circular(12)),
              ),
            ),
          ],
        ),
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
