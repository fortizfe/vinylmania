import 'package:material_ui/material_ui.dart';

import '../theme/vinylmania_colors.dart';
import 'badge_tone.dart';

/// Web `Badge`: small label chip.
class VmBadge extends StatelessWidget {
  const VmBadge({
    super.key,
    required this.label,
    this.tone = BadgeTone.neutral,
  });

  final String label;
  final BadgeTone tone;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final colors = VinylmaniaColors.of(context);
    final (
      Color? background,
      Color foreground,
      Border? border,
    ) = switch (tone) {
      BadgeTone.neutral => (
        scheme.surfaceContainerHigh,
        scheme.onSurface,
        Border.all(color: scheme.outline),
      ),
      BadgeTone.muted => (null, scheme.onSurfaceVariant, null),
      BadgeTone.accent => (
        colors.accent.withValues(alpha: 0.12),
        colors.accentText,
        null,
      ),
    };
    return DecoratedBox(
      decoration: BoxDecoration(
        color: background,
        border: border,
        borderRadius: const BorderRadius.all(Radius.circular(6)),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
        child: Text(
          label,
          style: Theme.of(context).textTheme.labelSmall
              ?.copyWith(color: foreground, fontWeight: FontWeight.w500),
        ),
      ),
    );
  }
}
