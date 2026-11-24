import 'package:material_ui/material_ui.dart';

import '../theme/vinylmania_colors.dart';
import 'pressable.dart';

/// Web `StarRating`: 0–5 stars, tapping the current star clears to 0.
/// Screen readers get one slider (increase/decrease); read-only when
/// [onChanged] is null, inert while [saving].
class StarRating extends StatelessWidget {
  const StarRating({
    super.key,
    required this.value,
    this.onChanged,
    this.saving = false,
    this.label = 'Rating',
  });

  final int value;
  final ValueChanged<int>? onChanged;
  final bool saving;
  final String label;

  static String _describe(int v) => v == 0 ? 'Not rated' : '$v of 5 stars';

  @override
  Widget build(BuildContext context) {
    final change = saving ? null : onChanged;
    final colors = VinylmaniaColors.of(context);
    final empty = Theme.of(context).colorScheme.outline;
    return Semantics(
      container: true,
      slider: true,
      enabled: change != null,
      label: label,
      value: _describe(value),
      increasedValue: value < 5 ? _describe(value + 1) : null,
      decreasedValue: value > 0 ? _describe(value - 1) : null,
      onIncrease: change != null && value < 5 ? () => change(value + 1) : null,
      onDecrease: change != null && value > 0 ? () => change(value - 1) : null,
      child: ExcludeSemantics(
        child: Opacity(
          opacity: saving ? 0.6 : 1,
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              for (var star = 1; star <= 5; star++)
                Pressable(
                  key: ValueKey('star-$star'),
                  onTap: change == null
                      ? null
                      : () => change(value == star ? 0 : star),
                  borderRadius: const BorderRadius.all(Radius.circular(8)),
                  child: SizedBox.square(
                    dimension: kMinInteractiveDimension,
                    child: Icon(
                      star <= value
                          ? Icons.star_rounded
                          : Icons.star_outline_rounded,
                      size: 24,
                      color: star <= value ? colors.accent : empty,
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
