import 'package:material_ui/material_ui.dart';

import '../theme/motion_tokens.dart';

/// The app's press + focus feedback (web `press.ts` / `focusRing.ts`):
/// scale on pointer-down, a 2 px primary ring on keyboard focus, click
/// cursor, Enter/Space activation. No scale under reduced motion.
class Pressable extends StatefulWidget {
  const Pressable({
    super.key,
    required this.onTap,
    required this.child,
    this.pressedScale = 0.97,
    this.semanticLabel,
    this.borderRadius = const BorderRadius.all(Radius.circular(12)),
  });

  final VoidCallback? onTap;
  final Widget child;
  final double pressedScale;
  final String? semanticLabel;

  /// Shape of the focus ring; match the child's corners.
  final BorderRadius borderRadius;

  @override
  State<Pressable> createState() => _PressableState();
}

class _PressableState extends State<Pressable> {
  bool _pressed = false;
  bool _focused = false;

  void _setPressed(bool pressed) {
    if (_pressed != pressed) setState(() => _pressed = pressed);
  }

  @override
  Widget build(BuildContext context) {
    final enabled = widget.onTap != null;
    final motion = MotionTokens.of(context);
    final animate = !MediaQuery.disableAnimationsOf(context);
    return Semantics(
      button: true,
      enabled: enabled,
      label: widget.semanticLabel,
      child: FocusableActionDetector(
        enabled: enabled,
        mouseCursor: enabled ? SystemMouseCursors.click : MouseCursor.defer,
        onShowFocusHighlight: (focused) => setState(() => _focused = focused),
        actions: {
          ActivateIntent: CallbackAction<ActivateIntent>(
            onInvoke: (_) {
              widget.onTap?.call();
              return null;
            },
          ),
        },
        child: GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTapDown: enabled ? (_) => _setPressed(true) : null,
          onTapUp: (_) => _setPressed(false),
          onTapCancel: () => _setPressed(false),
          onTap: widget.onTap,
          child: AnimatedScale(
            scale: enabled && animate && _pressed ? widget.pressedScale : 1,
            duration: animate ? motion.press : Duration.zero,
            curve: motion.easeOut,
            child: DecoratedBox(
              position: DecorationPosition.foreground,
              decoration: _focused && enabled
                  ? BoxDecoration(
                      borderRadius: widget.borderRadius,
                      border: Border.all(
                        color: Theme.of(context).colorScheme.primary,
                        width: 2,
                      ),
                    )
                  : const BoxDecoration(),
              child: widget.child,
            ),
          ),
        ),
      ),
    );
  }
}
