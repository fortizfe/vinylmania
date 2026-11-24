import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';
import 'package:vinylmania/ui/core/theme/app_theme.dart';
import 'package:vinylmania/ui/core/theme/motion_tokens.dart';
import 'package:vinylmania/ui/core/theme/vinylmania_colors.dart';

double _contrast(Color a, Color b) {
  final la = a.computeLuminance();
  final lb = b.computeLuminance();
  return (la > lb ? la + 0.05 : lb + 0.05) / (la > lb ? lb + 0.05 : la + 0.05);
}

void main() {
  for (final (name, theme, brightness) in [
    ('light', buildLightTheme(), Brightness.light),
    ('dark', buildDarkTheme(), Brightness.dark),
  ]) {
    group('$name theme', () {
      final scheme = theme.colorScheme;
      final colors = theme.extension<VinylmaniaColors>()!;

      test('has the brand brightness and both extensions', () {
        expect(scheme.brightness, brightness);
        expect(theme.extension<MotionTokens>(), isNotNull);
        expect(scheme.primaryContainer, const Color(0xFF4F46E5));
        expect(scheme.onPrimaryContainer, const Color(0xFFFFFFFF));
        expect(colors.ratingLow, const Color(0xFFDC2626));
        expect(colors.ratingMedium, const Color(0xFFFBBF24));
        expect(colors.ratingHigh, const Color(0xFF15803D));
      });

      test('display styles use Anton with tight leading and tracking', () {
        final style = theme.textTheme.displaySmall!;
        expect(style.fontFamily, 'Anton');
        expect(style.height, 1.05);
        expect(style.letterSpacing, closeTo(-0.02 * style.fontSize!, 0.001));
        expect(theme.textTheme.bodyMedium!.fontFamily, isNot('Anton'));
      });

      final textPairs = <String, (Color, Color)>{
        'onSurface/surface': (scheme.onSurface, scheme.surface),
        'onSurfaceVariant/surface': (scheme.onSurfaceVariant, scheme.surface),
        'onSurface/card': (scheme.onSurface, scheme.surfaceContainer),
        'onSurfaceVariant/card': (
          scheme.onSurfaceVariant,
          scheme.surfaceContainer,
        ),
        'primary/surface': (scheme.primary, scheme.surface),
        'primary/card': (scheme.primary, scheme.surfaceContainer),
        'onPrimary/primary': (scheme.onPrimary, scheme.primary),
        'onPrimaryContainer/primaryContainer': (
          scheme.onPrimaryContainer,
          scheme.primaryContainer,
        ),
        'error/surface': (scheme.error, scheme.surface),
        'error/card': (scheme.error, scheme.surfaceContainer),
        'accentText/surface': (colors.accentText, scheme.surface),
        'accentText/card': (colors.accentText, scheme.surfaceContainer),
        'warning banner': (colors.onWarningSurface, colors.warningSurface),
      };
      for (final MapEntry(key: pair, value: (fg, bg)) in textPairs.entries) {
        test('$pair text contrast ≥ 4.5:1', () {
          expect(_contrast(fg, bg), greaterThanOrEqualTo(4.5));
        });
      }

      test('outline is a ≥ 3:1 UI boundary on surface and cards', () {
        expect(
          _contrast(scheme.outline, scheme.surface),
          greaterThanOrEqualTo(3),
        );
        expect(
          _contrast(scheme.outline, scheme.surfaceContainer),
          greaterThanOrEqualTo(3),
        );
      });
    });
  }

  test('motion tokens match the web', () {
    final m = buildLightTheme().extension<MotionTokens>()!;
    expect(m.press, const Duration(milliseconds: 130));
    expect(m.fade, const Duration(milliseconds: 200));
    expect(m.collapse, const Duration(milliseconds: 200));
    expect(m.drawer, const Duration(milliseconds: 250));
    expect(m.easeOut, const Cubic(0.23, 1, 0.32, 1));
    expect(m.easeInOut, const Cubic(0.77, 0, 0.175, 1));
    expect(m.easeDrawer, const Cubic(0.32, 0.72, 0, 1));
  });
}
