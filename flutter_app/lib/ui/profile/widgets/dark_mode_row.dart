import 'package:material_ui/material_ui.dart';

import '../../core/widgets/vm_card.dart';

/// The Preferences row: "Dark mode" + an adaptive switch showing the
/// appearance in use (saved choice, or the system's until one is saved).
class DarkModeRow extends StatelessWidget {
  const DarkModeRow({super.key, required this.onChanged});

  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    return VmCard(
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                ExcludeSemantics(
                  child: Text(
                    'Dark mode',
                    style: TextStyle(
                      color: scheme.onSurface,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ),
                Text(
                  'Switch between a light or dark appearance for the whole '
                  'app.',
                  style: TextStyle(color: scheme.onSurfaceVariant),
                ),
              ],
            ),
          ),
          const SizedBox(width: 16),
          Semantics(
            label: 'Dark mode',
            child: Switch.adaptive(
              value: theme.brightness == Brightness.dark,
              onChanged: onChanged,
            ),
          ),
        ],
      ),
    );
  }
}
