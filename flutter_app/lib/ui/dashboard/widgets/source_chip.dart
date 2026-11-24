import 'package:material_ui/material_ui.dart';

import '../../core/widgets/pressable.dart';

/// One source filter pill (web `FeedSourceFilterBar` button). A down source
/// says "unavailable" in words next to a warning icon, not by colour alone.
class SourceChip extends StatelessWidget {
  const SourceChip({
    super.key,
    required this.label,
    required this.selected,
    required this.onTap,
    this.unavailable = false,
  });

  final String label;
  final bool selected;
  final bool unavailable;
  final VoidCallback onTap;

  static const _radius = BorderRadius.all(Radius.circular(999));

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final foreground = selected ? scheme.onPrimary : scheme.onSurface;
    final marker = selected ? scheme.onPrimary : scheme.onSurfaceVariant;
    final style = theme.textTheme.labelLarge?.copyWith(color: foreground);
    return Semantics(
      selected: selected,
      child: Pressable(
        onTap: onTap,
        borderRadius: _radius,
        semanticLabel: unavailable ? '$label unavailable' : label,
        child: ExcludeSemantics(
          child: ConstrainedBox(
            constraints: const BoxConstraints(
              minHeight: kMinInteractiveDimension,
              minWidth: kMinInteractiveDimension,
            ),
            child: DecoratedBox(
              decoration: BoxDecoration(
                color: selected ? scheme.primary : scheme.surfaceContainerHigh,
                borderRadius: _radius,
              ),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 14),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(label, style: style),
                    if (unavailable) ...[
                      const SizedBox(width: 6),
                      Icon(
                        Icons.warning_amber_rounded,
                        size: 16,
                        color: marker,
                      ),
                      const SizedBox(width: 2),
                      Text(
                        'unavailable',
                        style: style?.copyWith(color: marker),
                      ),
                    ],
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
