import 'package:material_ui/material_ui.dart';

/// Curves, durations and springs ported from `global.css` / `motion/`.
/// Values never change between themes, so `lerp` keeps `this`.
class MotionTokens extends ThemeExtension<MotionTokens> {
  const MotionTokens();

  final Cubic easeOut = const Cubic(0.23, 1, 0.32, 1);
  final Cubic easeInOut = const Cubic(0.77, 0, 0.175, 1);
  final Cubic easeDrawer = const Cubic(0.32, 0.72, 0, 1);

  final Duration press = const Duration(milliseconds: 130);
  final Duration fade = const Duration(milliseconds: 200);
  final Duration collapse = const Duration(milliseconds: 200);
  final Duration drawer = const Duration(milliseconds: 250);

  /// Skeleton pulse half-cycle (Tailwind `animate-pulse` is 2 s per cycle).
  final Duration pulse = const Duration(milliseconds: 1000);

  SpringDescription get springDefault =>
      SpringDescription.withDurationAndBounce(
        duration: const Duration(milliseconds: 400),
      );
  SpringDescription get springSheet => SpringDescription.withDurationAndBounce(
    duration: const Duration(milliseconds: 350),
  );
  SpringDescription get springMomentum =>
      SpringDescription.withDurationAndBounce(
        duration: const Duration(milliseconds: 500),
        bounce: 0.2,
      );

  static MotionTokens of(BuildContext context) =>
      Theme.of(context).extension<MotionTokens>() ?? const MotionTokens();

  @override
  MotionTokens copyWith() => this;

  @override
  MotionTokens lerp(MotionTokens? other, double t) => this;
}
