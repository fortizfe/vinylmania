import 'package:material_ui/material_ui.dart';

import '../../../domain/models/collection_stats/stat_breakdown.dart';
import '../../core/theme/motion_tokens.dart';
import '../../core/widgets/pressable.dart';
import '../../core/widgets/vm_card.dart';
import '../stats_format.dart';
import 'stats_heading.dart';

/// A ranked facet breakdown with length-encoded bars and the "Otros (N)"
/// disclosure for the collapsed remainder.
class StatBreakdownCard extends StatefulWidget {
  const StatBreakdownCard({
    super.key,
    required this.title,
    required this.breakdown,
  });

  final String title;
  final StatBreakdown breakdown;

  @override
  State<StatBreakdownCard> createState() => _StatBreakdownCardState();
}

class _StatBreakdownCardState extends State<StatBreakdownCard> {
  bool _othersExpanded = false;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final motion = MotionTokens.of(context);
    final animate = !MediaQuery.disableAnimationsOf(context);
    final buckets = widget.breakdown.buckets;
    final others = widget.breakdown.others;
    final max = buckets.fold(0, (m, b) => b.count > m ? b.count : m);
    final muted = TextStyle(color: scheme.onSurfaceVariant);

    return VmCard(
      padding: const EdgeInsets.all(12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          StatsHeading(widget.title),
          const SizedBox(height: 8),
          if (buckets.isEmpty)
            Text('No data for this breakdown yet.', style: muted)
          else
            for (final bucket in buckets)
              MergeSemantics(
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 6),
                  child: Row(
                    children: [
                      SizedBox(
                        width: 112,
                        child: Text(
                          bucket.label,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(color: scheme.onSurface),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: ExcludeSemantics(
                          child: ClipRRect(
                            borderRadius: BorderRadius.circular(4),
                            child: Container(
                              height: 8,
                              color: scheme.surfaceContainerHighest,
                              alignment: Alignment.centerLeft,
                              child: FractionallySizedBox(
                                widthFactor: max == 0
                                    ? 0
                                    : (bucket.count / max).clamp(0.02, 1),
                                child: ColoredBox(color: scheme.primary),
                              ),
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      ConstrainedBox(
                        constraints: const BoxConstraints(minWidth: 40),
                        child: Text(
                          formatCount(bucket.count),
                          textAlign: TextAlign.end,
                          style: TextStyle(
                            color: scheme.onSurface,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
          if (others != null) ...[
            const SizedBox(height: 4),
            Divider(height: 1, color: scheme.outlineVariant),
            Align(
              alignment: Alignment.centerLeft,
              child: Semantics(
                expanded: _othersExpanded,
                child: Pressable(
                  onTap: () =>
                      setState(() => _othersExpanded = !_othersExpanded),
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(
                      minHeight: kMinInteractiveDimension,
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        AnimatedRotation(
                          turns: _othersExpanded ? 0.25 : 0,
                          duration: animate ? motion.collapse : Duration.zero,
                          curve: motion.easeOut,
                          child: Icon(
                            Icons.chevron_right,
                            size: 20,
                            color: scheme.primary,
                          ),
                        ),
                        Text(
                          'Otros (${formatCount(others.count)})',
                          style: TextStyle(
                            color: scheme.primary,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
            if (_othersExpanded)
              Text(
                '${formatCount(others.hiddenBuckets)} more values, '
                '${formatCount(others.count)} ${records(others.count)} '
                'combined.',
                style: muted,
              ),
          ],
        ],
      ),
    );
  }
}
