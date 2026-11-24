import 'package:material_ui/material_ui.dart';

import '../theme/stone.dart';
import '../theme/vinylmania_colors.dart';

enum _Band { low, medium, high, unrated }

// Ported from frontend/src/lib/releaseRating.ts.
_Band _bandFor(double? average, int count) {
  if (average == null || !average.isFinite || count <= 0) return _Band.unrated;
  if (average < 0 || average > 5) return _Band.unrated;
  if (average <= 2.5) return _Band.low;
  if (average <= 4.09) return _Band.medium;
  return _Band.high;
}

/// Web `ReleaseRatingBadge`: community average in a colored 32×32 tile.
/// The value is always shown as text, so the band is never color-only.
class ReleaseRatingBadge extends StatelessWidget {
  const ReleaseRatingBadge({super.key, this.average, this.count = 0});

  final double? average;
  final int count;

  @override
  Widget build(BuildContext context) {
    final colors = VinylmaniaColors.of(context);
    final scheme = Theme.of(context).colorScheme;
    final band = _bandFor(average, count);
    final display = band == _Band.unrated ? '-' : average!.toStringAsFixed(1);
    final (Color background, Color foreground) = switch (band) {
      _Band.low => (colors.ratingLow, Colors.white),
      _Band.medium => (colors.ratingMedium, Stone.c900),
      _Band.high => (colors.ratingHigh, Colors.white),
      _Band.unrated => (
        colors.ratingUnrated,
        scheme.brightness == Brightness.dark ? Stone.c100 : Stone.c700,
      ),
    };
    return Semantics(
      label: band == _Band.unrated
          ? 'Rating not available'
          : 'Rating $display out of 5',
      child: ExcludeSemantics(
        child: DecoratedBox(
          decoration: BoxDecoration(
            color: background,
            border: band == _Band.unrated
                ? Border.all(color: scheme.outline)
                : null,
            borderRadius: const BorderRadius.all(Radius.circular(6)),
          ),
          child: SizedBox.square(
            dimension: 32,
            child: Center(
              child: Text(
                display,
                textScaler: TextScaler.noScaling,
                style: Theme.of(context).textTheme.labelSmall
                    ?.copyWith(color: foreground, fontWeight: FontWeight.w600),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
