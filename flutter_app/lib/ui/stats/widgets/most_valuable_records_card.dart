import 'package:material_ui/material_ui.dart';

import '../../../domain/models/collection_stats/per_disc_value.dart';
import '../../core/widgets/vm_card.dart';
import 'per_disc_value_row.dart';
import 'stats_heading.dart';

/// The top ≤ 10 discs by value.
class MostValuableRecordsCard extends StatelessWidget {
  const MostValuableRecordsCard({
    super.key,
    required this.records,
    required this.currency,
  });

  final List<PerDiscValue> records;
  final String? currency;

  @override
  Widget build(BuildContext context) {
    return VmCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const StatsHeading('Most valuable records'),
          const SizedBox(height: 8),
          for (final (i, disc) in records.indexed)
            PerDiscValueRow(disc: disc, currency: currency, rank: i + 1),
        ],
      ),
    );
  }
}
