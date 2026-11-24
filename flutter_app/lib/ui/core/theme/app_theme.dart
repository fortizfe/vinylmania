import 'package:material_ui/material_ui.dart';

import 'motion_tokens.dart';
import 'stone.dart';
import 'vinylmania_colors.dart';

const _indigo600 = Color(0xFF4F46E5);
const _indigo400 = Color(0xFF818CF8);
const _amber = Color(0xFFF59E0B);
const _amber700 = Color(0xFFB45309);
const _surfaceDark = Color(0xFF0B0B10);
const _surfaceRaisedDark = Color(0xFF16161F);

/// Light theme: white shell, stone-50 cards, stone-500 borders.
ThemeData buildLightTheme() => _build(
  const ColorScheme(
    brightness: Brightness.light,
    primary: _indigo600,
    onPrimary: Colors.white,
    primaryContainer: _indigo600,
    onPrimaryContainer: Colors.white,
    secondary: Stone.c700,
    onSecondary: Colors.white,
    tertiary: _amber,
    onTertiary: Stone.c950,
    error: Color(0xFFB91C1C),
    onError: Colors.white,
    surface: Colors.white,
    onSurface: Stone.c900,
    onSurfaceVariant: Stone.c600,
    surfaceContainerLowest: Colors.white,
    surfaceContainerLow: Stone.c50,
    surfaceContainer: Stone.c50,
    surfaceContainerHigh: Stone.c100,
    surfaceContainerHighest: Stone.c200,
    outline: Stone.c500,
    outlineVariant: Stone.c300,
  ),
  const VinylmaniaColors(
    accent: _amber,
    accentText: _amber700,
    ratingLow: Color(0xFFDC2626),
    ratingMedium: Color(0xFFFBBF24),
    ratingHigh: Color(0xFF15803D),
    ratingUnrated: Color(0xFFD1D5DB),
    surfaceRaised: Stone.c50,
    warningSurface: Color(0xFFFFFBEB),
    onWarningSurface: Color(0xFF78350F),
    warningBorder: Color(0xFFFDE68A),
  ),
);

/// Dark theme: near-black brand surface. `primary` is indigo-400 so text,
/// icons and focus rings pass AA on dark; filled buttons keep the brand
/// indigo-600 through `primaryContainer`, as on the web.
ThemeData buildDarkTheme() => _build(
  const ColorScheme(
    brightness: Brightness.dark,
    primary: _indigo400,
    onPrimary: Stone.c950,
    primaryContainer: _indigo600,
    onPrimaryContainer: Colors.white,
    secondary: Stone.c300,
    onSecondary: Stone.c950,
    tertiary: _amber,
    onTertiary: Stone.c950,
    error: Color(0xFFF87171),
    onError: Stone.c950,
    surface: _surfaceDark,
    onSurface: Stone.c100,
    onSurfaceVariant: Stone.c400,
    surfaceContainerLowest: _surfaceDark,
    surfaceContainerLow: _surfaceRaisedDark,
    surfaceContainer: _surfaceRaisedDark,
    surfaceContainerHigh: Stone.c900,
    surfaceContainerHighest: Stone.c800,
    outline: Stone.c500,
    outlineVariant: Stone.c700,
  ),
  const VinylmaniaColors(
    accent: _amber,
    accentText: _amber,
    ratingLow: Color(0xFFDC2626),
    ratingMedium: Color(0xFFFBBF24),
    ratingHigh: Color(0xFF15803D),
    ratingUnrated: Stone.c700,
    surfaceRaised: _surfaceRaisedDark,
    warningSurface: Color(0xFF451A03),
    onWarningSurface: Color(0xFFFDE68A),
    warningBorder: Color(0xFF78350F),
  ),
);

ThemeData _build(ColorScheme scheme, VinylmaniaColors colors) {
  final base = ThemeData(colorScheme: scheme, useMaterial3: true);
  return base.copyWith(
    scaffoldBackgroundColor: scheme.surface,
    textTheme: _withDisplayFont(base.textTheme, base.typography.englishLike),
    extensions: [colors, const MotionTokens()],
  );
}

/// Anton only for page/pillar headers and single-record titles.
/// Sizes come from [geometry] so the tracking can be set in em.
TextTheme _withDisplayFont(TextTheme t, TextTheme geometry) {
  TextStyle? anton(TextStyle? s) => s?.copyWith(
    fontFamily: 'Anton',
    fontWeight: FontWeight.w400,
    height: 1.05,
    letterSpacing: -0.02 * (s.fontSize ?? 14),
  );
  return t.copyWith(
    displayLarge: anton(t.displayLarge?.merge(geometry.displayLarge)),
    displayMedium: anton(t.displayMedium?.merge(geometry.displayMedium)),
    displaySmall: anton(t.displaySmall?.merge(geometry.displaySmall)),
    headlineLarge: anton(t.headlineLarge?.merge(geometry.headlineLarge)),
  );
}
