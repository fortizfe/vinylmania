import 'package:material_ui/material_ui.dart';

/// Brand colors `ColorScheme` has no slot for (`global.css` tokens).
class VinylmaniaColors extends ThemeExtension<VinylmaniaColors> {
  const VinylmaniaColors({
    required this.accent,
    required this.accentText,
    required this.ratingLow,
    required this.ratingMedium,
    required this.ratingHigh,
    required this.ratingUnrated,
    required this.surfaceRaised,
    required this.warningSurface,
    required this.onWarningSurface,
    required this.warningBorder,
    required this.cardShadow,
  });

  /// Amber as a fill or on dark surfaces.
  final Color accent;

  /// Amber as text/icon color on the current surfaces (AA-safe).
  final Color accentText;
  final Color ratingLow;
  final Color ratingMedium;
  final Color ratingHigh;
  final Color ratingUnrated;

  /// Cards, sheets and the header above the page.
  final Color surfaceRaised;

  /// Warning banners (web: amber-50/900/200, dark amber-950/200/900).
  final Color warningSurface;
  final Color onWarningSurface;
  final Color warningBorder;

  /// Card drop shadow (web `shadow-sm`, same in both themes).
  final Color cardShadow;

  static VinylmaniaColors of(BuildContext context) =>
      Theme.of(context).extension<VinylmaniaColors>()!;

  @override
  VinylmaniaColors copyWith({
    Color? accent,
    Color? accentText,
    Color? ratingLow,
    Color? ratingMedium,
    Color? ratingHigh,
    Color? ratingUnrated,
    Color? surfaceRaised,
    Color? warningSurface,
    Color? onWarningSurface,
    Color? warningBorder,
    Color? cardShadow,
  }) => VinylmaniaColors(
    accent: accent ?? this.accent,
    accentText: accentText ?? this.accentText,
    ratingLow: ratingLow ?? this.ratingLow,
    ratingMedium: ratingMedium ?? this.ratingMedium,
    ratingHigh: ratingHigh ?? this.ratingHigh,
    ratingUnrated: ratingUnrated ?? this.ratingUnrated,
    surfaceRaised: surfaceRaised ?? this.surfaceRaised,
    warningSurface: warningSurface ?? this.warningSurface,
    onWarningSurface: onWarningSurface ?? this.onWarningSurface,
    warningBorder: warningBorder ?? this.warningBorder,
    cardShadow: cardShadow ?? this.cardShadow,
  );

  @override
  VinylmaniaColors lerp(VinylmaniaColors? other, double t) {
    if (other == null) return this;
    return VinylmaniaColors(
      accent: Color.lerp(accent, other.accent, t)!,
      accentText: Color.lerp(accentText, other.accentText, t)!,
      ratingLow: Color.lerp(ratingLow, other.ratingLow, t)!,
      ratingMedium: Color.lerp(ratingMedium, other.ratingMedium, t)!,
      ratingHigh: Color.lerp(ratingHigh, other.ratingHigh, t)!,
      ratingUnrated: Color.lerp(ratingUnrated, other.ratingUnrated, t)!,
      surfaceRaised: Color.lerp(surfaceRaised, other.surfaceRaised, t)!,
      warningSurface: Color.lerp(warningSurface, other.warningSurface, t)!,
      onWarningSurface: Color.lerp(
        onWarningSurface,
        other.onWarningSurface,
        t,
      )!,
      warningBorder: Color.lerp(warningBorder, other.warningBorder, t)!,
      cardShadow: Color.lerp(cardShadow, other.cardShadow, t)!,
    );
  }
}
