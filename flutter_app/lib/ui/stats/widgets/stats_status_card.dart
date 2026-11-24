import 'package:material_ui/material_ui.dart';

import '../../core/widgets/discogs_link_gate.dart';
import '../../core/widgets/error_retry_card.dart';
import '../../core/widgets/vm_card.dart';
import '../view_models/stats_view_model.dart';
import '../view_models/stats_gate.dart';

/// Everything that replaces the statistics: the Discogs gate, the error with
/// Retry, or the empty collection.
class StatsStatusCard extends StatelessWidget {
  const StatsStatusCard({super.key, required this.viewModel});

  final StatsViewModel viewModel;

  @override
  Widget build(BuildContext context) {
    final gate = viewModel.gate;
    if (gate != null) {
      return DiscogsLinkGate(
        relink: gate == StatsGate.relink,
        context: 'stats',
      );
    }
    if (viewModel.hasStatisticsError) {
      return ErrorRetryCard(
        message:
            'Something went wrong while loading your collection stats. Please '
            'try again.',
        onRetry: viewModel.load,
      );
    }
    return VmCard(
      child: Text(
        "Your Discogs collection has no records yet. Add some records on "
        "Discogs and they'll show up here.",
        style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant),
      ),
    );
  }
}
