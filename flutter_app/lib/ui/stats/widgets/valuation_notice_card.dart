import 'package:material_ui/material_ui.dart';

import '../../core/widgets/vm_button.dart';
import '../../core/widgets/vm_card.dart';
import 'stats_heading.dart';
import '../view_models/valuation_notice.dart';

/// Non-blocking notice when the valuation can't run; the statistics stay.
class ValuationNoticeCard extends StatelessWidget {
  const ValuationNoticeCard({
    super.key,
    required this.notice,
    required this.onRetry,
  });

  final ValuationNotice notice;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final (heading, body) = switch (notice) {
      ValuationNotice.sellerSettings => (
        'Estimated value needs your Discogs seller settings',
        "Discogs only provides price estimates once you've completed your "
            'seller settings on discogs.com. Your collection statistics above '
            'are unaffected.',
      ),
      ValuationNotice.unavailable => (
        "We couldn't estimate your collection's value right now",
        'Discogs did not return price data this time. Your collection '
            'statistics above are unaffected — wait a moment, then try the '
            'valuation again.',
      ),
    };
    return VmCard(
      child: Semantics(
        liveRegion: true,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            StatsHeading(heading),
            const SizedBox(height: 8),
            Text(
              body,
              style: TextStyle(
                color: Theme.of(context).colorScheme.onSurfaceVariant,
              ),
            ),
            if (notice == ValuationNotice.unavailable) ...[
              const SizedBox(height: 12),
              VmButton.secondary(
                onPressed: onRetry,
                label: 'Try the valuation again',
              ),
            ],
          ],
        ),
      ),
    );
  }
}
