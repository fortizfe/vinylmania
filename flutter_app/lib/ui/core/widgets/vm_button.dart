import 'package:material_ui/material_ui.dart';

import 'pressable.dart';

enum _Variant { primary, secondary, icon }

/// Web `Button`: primary (indigo fill), secondary (outlined) and icon-only
/// (48×48, [label] as tooltip and semantic label). `loading` disables
/// without changing the size.
class VmButton extends StatelessWidget {
  const VmButton.primary({
    super.key,
    required this.onPressed,
    required this.label,
    this.icon,
    this.loading = false,
  }) : _variant = _Variant.primary;

  const VmButton.secondary({
    super.key,
    required this.onPressed,
    required this.label,
    this.icon,
    this.loading = false,
  }) : _variant = _Variant.secondary;

  const VmButton.icon({
    super.key,
    required this.onPressed,
    required this.label,
    required IconData this.icon,
    this.loading = false,
  }) : _variant = _Variant.icon;

  final VoidCallback? onPressed;
  final String label;
  final IconData? icon;
  final bool loading;
  final _Variant _variant;

  static const _radius = BorderRadius.all(Radius.circular(12));

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final primary = _variant == _Variant.primary;
    final foreground = primary ? scheme.onPrimaryContainer : scheme.onSurface;
    final enabled = onPressed != null && !loading;

    final Widget content = _variant == _Variant.icon
        ? Tooltip(
            message: label,
            excludeFromSemantics: true,
            child: SizedBox.square(
              dimension: kMinInteractiveDimension,
              child: Icon(icon, size: 20, color: foreground),
            ),
          )
        : ConstrainedBox(
            constraints: const BoxConstraints(
              minHeight: kMinInteractiveDimension,
              minWidth: kMinInteractiveDimension,
            ),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  if (icon != null) ...[
                    Icon(icon, size: 18, color: foreground),
                    const SizedBox(width: 8),
                  ],
                  Flexible(
                    child: Text(
                      label,
                      textAlign: TextAlign.center,
                      style: Theme.of(context).textTheme.labelLarge?.copyWith(
                        color: foreground,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          );

    return Pressable(
      onTap: enabled ? onPressed : null,
      semanticLabel: _variant == _Variant.icon ? label : null,
      borderRadius: _radius,
      child: Opacity(
        opacity: enabled || onPressed == null && !loading ? 1 : 0.6,
        child: DecoratedBox(
          decoration: BoxDecoration(
            color: primary ? scheme.primaryContainer : null,
            border: primary ? null : Border.all(color: scheme.outline),
            borderRadius: _radius,
          ),
          child: content,
        ),
      ),
    );
  }
}
