import 'package:material_ui/material_ui.dart';

import '../../core/theme/motion_tokens.dart';
import '../../core/widgets/vm_button.dart';
import '../../core/widgets/vm_card.dart';
import '../stats_format.dart';
import '../view_models/stats_view_model.dart';
import '../view_models/valuation_status.dart';

/// Running total in the Discogs currency, coverage, progress while the loop
/// runs, the "come back later" note and the retry of failed discs.
class ValuationCard extends StatelessWidget {
  const ValuationCard({super.key, required this.viewModel});

  final StatsViewModel viewModel;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final motion = MotionTokens.of(context);
    final animate = !MediaQuery.disableAnimationsOf(context);
    final vm = viewModel;
    final valuation = vm.valuation;
    final total = formatCurrency(
      valuation?.estimatedTotal ?? 0,
      valuation?.currency,
    );
    final muted = TextStyle(color: scheme.onSurfaceVariant);
    final pct = (vm.progress * 100).round();
    final retryable = vm.retryable;

    return VmCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          MergeSemantics(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Total estimated value',
                  style: muted.copyWith(fontWeight: FontWeight.w500),
                ),
                AnimatedSwitcher(
                  duration: animate ? motion.fade : Duration.zero,
                  switchInCurve: motion.easeOut,
                  layoutBuilder: (current, previous) => Stack(
                    alignment: Alignment.centerLeft,
                    children: [...previous, ?current],
                  ),
                  child: Text(
                    total,
                    key: ValueKey(total),
                    style: theme.textTheme.headlineLarge?.copyWith(
                      color: scheme.onSurface,
                    ),
                  ),
                ),
                if (valuation != null)
                  Text(
                    'estimado sobre ${valuation.coveredCount} de '
                    '${valuation.totalCount} discos',
                    style: muted,
                  ),
              ],
            ),
          ),
          if (vm.isComputing) ...[
            const SizedBox(height: 16),
            Semantics(
              label: 'Progreso de la valoración',
              value: '$pct%',
              child: ClipRRect(
                borderRadius: BorderRadius.circular(3),
                child: Container(
                  height: 6,
                  color: scheme.surfaceContainerHighest,
                  alignment: Alignment.centerLeft,
                  child: AnimatedFractionallySizedBox(
                    duration: animate ? motion.collapse : Duration.zero,
                    curve: motion.easeOut,
                    widthFactor: (pct / 100).clamp(0.04, 1),
                    heightFactor: 1,
                    child: ColoredBox(color: scheme.primary),
                  ),
                ),
              ),
            ),
          ],
          if (vm.isLongRunning) ...[
            const SizedBox(height: 16),
            Text(
              'Esto puede tardar un rato. Puedes cerrar esta página y volver '
              'más tarde: el progreso se guarda y la valoración continúa '
              'donde la dejaste.',
              style: muted,
            ),
          ],
          if (retryable > 0) ...[
            const SizedBox(height: 16),
            Text(
              'No pudimos consultar el precio de $retryable '
              '${retryable == 1 ? 'disco' : 'discos'}. Puedes reintentarlo sin '
              'repetir toda la valoración.',
              style: muted,
            ),
            const SizedBox(height: 8),
            Align(
              alignment: Alignment.centerLeft,
              child: VmButton.secondary(
                onPressed: vm.retryFailedDiscs,
                label: 'Reintentar esos discos',
              ),
            ),
          ],
          Semantics(
            liveRegion: true,
            label: vm.isComputing
                ? 'Calculando la valoración de tu colección…'
                : vm.valuationStatus == ValuationStatus.complete
                ? 'Valoración completada.'
                : '',
            child: const SizedBox.shrink(),
          ),
        ],
      ),
    );
  }
}
