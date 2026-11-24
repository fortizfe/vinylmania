import 'package:material_ui/material_ui.dart';

import 'pressable.dart';

/// Web `Card`: raised surface, 1 px outline, 12 px corners. Presses at
/// 0.99 when [onTap] is set.
class VmCard extends StatelessWidget {
  const VmCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(16),
    this.onTap,
    this.semanticLabel,
  });

  final Widget child;
  final EdgeInsets padding;
  final VoidCallback? onTap;

  /// Label of the tappable card; defaults to its text content.
  final String? semanticLabel;

  static const _radius = BorderRadius.all(Radius.circular(12));

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final card = DecoratedBox(
      decoration: BoxDecoration(
        color: scheme.surfaceContainer,
        border: Border.all(color: scheme.outline),
        borderRadius: _radius,
        boxShadow: const [
          BoxShadow(
            color: Color(0x0D000000),
            blurRadius: 2,
            offset: Offset(0, 1),
          ),
        ],
      ),
      child: Padding(padding: padding, child: child),
    );
    if (onTap == null) return card;
    return Pressable(
      onTap: onTap,
      pressedScale: 0.99,
      semanticLabel: semanticLabel,
      borderRadius: _radius,
      child: card,
    );
  }
}
