import 'package:material_ui/material_ui.dart';

import '../../../domain/models/collection_stats/per_disc_value.dart';
import '../stats_format.dart';

/// One disc: (rank,) title, artist · condition, and its value or the written
/// reason it has none — never a colour-only state.
class PerDiscValueRow extends StatelessWidget {
  const PerDiscValueRow({
    super.key,
    required this.disc,
    required this.currency,
    this.rank,
  });

  final PerDiscValue disc;
  final String? currency;
  final int? rank;

  static const _reasons = {
    'no_market_data': 'sin datos de mercado',
    'no_condition': 'sin estado',
  };

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final small = Theme.of(context).textTheme.bodySmall;
    final muted = TextStyle(color: scheme.onSurfaceVariant);
    final value = disc.value;
    final condition = disc.mediaCondition;
    return MergeSemantics(
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 6),
        child: Row(
          children: [
            if (rank != null) ...[
              ConstrainedBox(
                constraints: const BoxConstraints(minWidth: 24),
                child: Text('$rank', textAlign: TextAlign.end, style: muted),
              ),
              const SizedBox(width: 12),
            ],
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    disc.title,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      color: scheme.onSurface,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                  Text(
                    condition == null
                        ? disc.artist
                        : '${disc.artist} · $condition',
                    overflow: TextOverflow.ellipsis,
                    style: small?.merge(muted),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 12),
            if (value != null)
              Text(
                formatCurrency(value, currency),
                style: TextStyle(
                  color: scheme.onSurface,
                  fontWeight: FontWeight.w600,
                ),
              )
            else
              Text(_reasons[disc.reason] ?? '—', style: muted),
          ],
        ),
      ),
    );
  }
}
