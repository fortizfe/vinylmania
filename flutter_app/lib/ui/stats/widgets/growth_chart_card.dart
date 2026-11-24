import 'package:material_ui/material_ui.dart';

import '../../../domain/models/collection_stats/growth_point.dart';
import '../../core/theme/motion_tokens.dart';
import '../../core/widgets/pressable.dart';
import '../../core/widgets/vm_card.dart';
import '../stats_format.dart';
import 'growth_chart_painter.dart';
import 'stats_heading.dart';

/// Growth over time: per-period bars or the cumulative line, with a spoken
/// summary. The draw-in runs on `fade` + `easeOut`, none under reduced
/// motion.
class GrowthChartCard extends StatefulWidget {
  const GrowthChartCard({super.key, required this.points});

  final List<GrowthPoint> points;

  @override
  State<GrowthChartCard> createState() => _GrowthChartCardState();
}

class _GrowthChartCardState extends State<GrowthChartCard> {
  bool _cumulative = false;

  String get _summary {
    final points = widget.points;
    if (points.isEmpty) {
      return 'Collection growth by month: no records added yet.';
    }
    final added = points.fold(0, (sum, p) => sum + p.added);
    return 'Collection growth by month: $added ${records(added)} added between '
        '${formatPeriod(points.first.period)} and '
        '${formatPeriod(points.last.period)}, reaching a cumulative total of '
        '${points.last.cumulative}.';
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final motion = MotionTokens.of(context);
    final animate = !MediaQuery.disableAnimationsOf(context);
    final points = widget.points;
    final muted = TextStyle(color: scheme.onSurfaceVariant);

    return VmCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Wrap(
            alignment: WrapAlignment.spaceBetween,
            crossAxisAlignment: WrapCrossAlignment.center,
            spacing: 12,
            runSpacing: 8,
            children: [
              const StatsHeading('Growth over time'),
              Semantics(
                container: true,
                label: 'Growth chart series',
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    border: Border.all(color: scheme.outline),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Padding(
                    padding: const EdgeInsets.all(2),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Flexible(
                          child: _seriesButton('Per period', cumulative: false),
                        ),
                        Flexible(
                          child: _seriesButton('Cumulative', cumulative: true),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          if (points.isEmpty)
            Text(
              'No growth data yet — your collection has no dated additions.',
              style: muted,
            )
          else ...[
            Semantics(
              container: true,
              label: _summary,
              child: AspectRatio(
                aspectRatio: 640 / 200,
                child: TweenAnimationBuilder<double>(
                  key: ValueKey(_cumulative),
                  tween: Tween(begin: animate ? 0 : 1, end: 1),
                  duration: animate ? motion.fade : Duration.zero,
                  curve: motion.easeOut,
                  builder: (context, progress, _) => CustomPaint(
                    painter: GrowthChartPainter(
                      points: points,
                      cumulative: _cumulative,
                      progress: progress,
                      color: scheme.primary,
                      baselineColor: scheme.outlineVariant,
                    ),
                  ),
                ),
              ),
            ),
            const SizedBox(height: 4),
            ExcludeSemantics(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 14),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Flexible(
                      child: Text(
                        formatPeriod(points.first.period),
                        style: muted,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Flexible(
                      child: Text(
                        formatPeriod(points.last.period),
                        textAlign: TextAlign.end,
                        style: muted,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _seriesButton(String label, {required bool cumulative}) {
    final scheme = Theme.of(context).colorScheme;
    final active = _cumulative == cumulative;
    return Semantics(
      selected: active,
      child: Pressable(
        onTap: () => setState(() => _cumulative = cumulative),
        borderRadius: BorderRadius.circular(10),
        child: Container(
          constraints: const BoxConstraints(
            minHeight: kMinInteractiveDimension,
          ),
          alignment: Alignment.center,
          padding: const EdgeInsets.symmetric(horizontal: 12),
          decoration: BoxDecoration(
            color: active ? scheme.primaryContainer : null,
            borderRadius: BorderRadius.circular(10),
          ),
          child: Text(
            label,
            textAlign: TextAlign.center,
            style: TextStyle(
              color: active
                  ? scheme.onPrimaryContainer
                  : scheme.onSurfaceVariant,
              fontWeight: FontWeight.w500,
            ),
          ),
        ),
      ),
    );
  }
}
