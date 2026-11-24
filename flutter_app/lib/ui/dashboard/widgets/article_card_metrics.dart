import 'package:material_ui/material_ui.dart';

import 'article_card_variant.dart';

/// Per-variant box of [ArticleCard] and its skeleton (web `feedCardLayout` /
/// `feedCardMedia`), so loading and loaded cards take the same space.
class ArticleCardMetrics {
  ArticleCardMetrics.of(BuildContext context, this.variant)
    : _theme = Theme.of(context),
      _width = MediaQuery.sizeOf(context).width;

  final ArticleCardVariant variant;
  final ThemeData _theme;
  final double _width;

  bool get _sm => _width >= 640;

  /// Web shows the lead's excerpt from `sm` up.
  bool get showExcerpt => variant == ArticleCardVariant.lead && _sm;

  int get titleLines => variant == ArticleCardVariant.row ? 2 : 3;

  double get mediaGap => switch (variant) {
    ArticleCardVariant.lead => 12,
    ArticleCardVariant.tile => 8,
    ArticleCardVariant.row => _sm ? 16 : 12,
  };

  /// Square side of a row's thumbnail.
  double get rowMediaSize => _sm ? 96 : 72;

  BorderRadius get mediaRadius =>
      BorderRadius.circular(variant == ArticleCardVariant.lead ? 12 : 8);

  TextStyle? get titleStyle {
    final t = _theme.textTheme;
    final color = _theme.colorScheme.onSurface;
    return switch (variant) {
      ArticleCardVariant.lead => t.headlineLarge?.copyWith(
        fontSize: _width >= 1024 ? 36 : 24,
        color: color,
      ),
      ArticleCardVariant.tile => t.titleMedium?.copyWith(
        fontWeight: FontWeight.w600,
        color: color,
      ),
      ArticleCardVariant.row => (_sm ? t.titleMedium : t.bodyMedium)?.copyWith(
        fontWeight: FontWeight.w600,
        color: color,
      ),
    };
  }

  TextStyle? get excerptStyle => _theme.textTheme.bodyMedium?.copyWith(
    color: _theme.colorScheme.onSurfaceVariant,
  );

  TextStyle? get metaStyle => _theme.textTheme.bodySmall?.copyWith(
    color: _theme.colorScheme.onSurfaceVariant,
  );
}
