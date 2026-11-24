import 'package:material_ui/material_ui.dart';

import 'pressable.dart';

/// Bottom tab bar for compact windows. Unlike `NavigationBar` it allows no
/// selected tab (Profile is reached from the avatar, not a tab).
class CompactNavBar extends StatelessWidget {
  const CompactNavBar({
    super.key,
    required this.destinations,
    required this.selectedIndex,
    required this.onSelected,
  });

  final List<({String label, IconData icon, IconData selectedIcon})>
  destinations;
  final int? selectedIndex;
  final ValueChanged<int> onSelected;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    return DecoratedBox(
      decoration: BoxDecoration(
        color: scheme.surfaceContainer,
        border: Border(top: BorderSide(color: scheme.outlineVariant)),
      ),
      child: SafeArea(
        top: false,
        // Same clamp as Material's NavigationBar: labels stay on one line.
        child: MediaQuery.withClampedTextScaling(
          maxScaleFactor: 1.3,
          child: Row(
            children: [
              for (final (i, d) in destinations.indexed)
                Expanded(
                  child: Semantics(
                    selected: i == selectedIndex,
                    child: Pressable(
                      onTap: () => onSelected(i),
                      semanticLabel: d.label,
                      child: ExcludeSemantics(
                        child: _item(theme, d, i == selectedIndex),
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _item(
    ThemeData theme,
    ({String label, IconData icon, IconData selectedIcon}) d,
    bool selected,
  ) {
    final color = selected
        ? theme.colorScheme.primary
        : theme.colorScheme.onSurfaceVariant;
    return ConstrainedBox(
      constraints: const BoxConstraints(minHeight: 64),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(selected ? d.selectedIcon : d.icon, color: color),
          const SizedBox(height: 4),
          Text(
            d.label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: theme.textTheme.labelSmall?.copyWith(
              color: color,
              fontWeight: selected ? FontWeight.w600 : FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }
}
