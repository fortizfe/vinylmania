import 'package:material_ui/material_ui.dart';

import '../theme/motion_tokens.dart';
import 'pressable.dart';
import 'view_mode.dart';

/// Web `ViewModeToggle`: a two-option radio group (grid / list).
// ponytail: color fade instead of the web's sliding spring pill; add the
// pill when motion polish is scheduled.
class ViewModeToggle extends StatelessWidget {
  const ViewModeToggle({
    super.key,
    required this.mode,
    required this.onChanged,
  });

  final ViewMode mode;
  final ValueChanged<ViewMode> onChanged;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final motion = MotionTokens.of(context);
    final animate = !MediaQuery.disableAnimationsOf(context);
    Widget option(ViewMode value, String label, IconData icon) {
      final selected = value == mode;
      return Semantics(
        inMutuallyExclusiveGroup: true,
        checked: selected,
        child: Pressable(
          onTap: () {
            if (!selected) onChanged(value);
          },
          semanticLabel: label,
          borderRadius: const BorderRadius.all(Radius.circular(8)),
          child: AnimatedContainer(
            duration: animate ? motion.fade : Duration.zero,
            curve: motion.easeOut,
            width: kMinInteractiveDimension,
            height: kMinInteractiveDimension,
            decoration: BoxDecoration(
              color: selected ? scheme.primaryContainer : null,
              borderRadius: const BorderRadius.all(Radius.circular(8)),
            ),
            child: Icon(
              icon,
              size: 20,
              color: selected
                  ? scheme.onPrimaryContainer
                  : scheme.onSurfaceVariant,
            ),
          ),
        ),
      );
    }

    return Semantics(
      label: 'View mode',
      container: true,
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: scheme.surface,
          border: Border.all(color: scheme.outline),
          borderRadius: const BorderRadius.all(Radius.circular(12)),
        ),
        child: Padding(
          padding: const EdgeInsets.all(4),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              option(ViewMode.grid, 'Grid view', Icons.grid_view_rounded),
              const SizedBox(width: 4),
              option(ViewMode.list, 'List view', Icons.view_list_rounded),
            ],
          ),
        ),
      ),
    );
  }
}
