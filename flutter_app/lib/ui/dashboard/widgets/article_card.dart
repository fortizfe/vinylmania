import 'package:material_ui/material_ui.dart';

import '../../../domain/models/feeds/article.dart';
import '../../core/open_external_link.dart';
import '../../core/widgets/pressable.dart';
import 'article_age.dart';
import 'article_card_metrics.dart';
import 'article_card_variant.dart';
import 'reserved_lines.dart';
import 'source_monogram.dart';

/// One news article (web `FeedArticleCard`): image (or the source
/// monogram), title, excerpt on the lead from 640 px up, source · age.
/// Opens the article in the system browser.
class ArticleCard extends StatelessWidget {
  const ArticleCard({
    super.key,
    required this.article,
    this.variant = ArticleCardVariant.tile,
  });

  final Article article;
  final ArticleCardVariant variant;

  @override
  Widget build(BuildContext context) {
    final m = ArticleCardMetrics.of(context, variant);
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final monogram = ColoredBox(
      color: scheme.surfaceContainerHigh,
      child: Center(
        child: Text(
          sourceMonogram(article.sourceName),
          style: theme.textTheme.titleLarge?.copyWith(
            fontWeight: FontWeight.w600,
            color: scheme.onSurfaceVariant,
          ),
        ),
      ),
    );
    final url = article.imageUrl;
    final image = ClipRRect(
      borderRadius: m.mediaRadius,
      child: url == null
          ? monogram
          : Image.network(
              url,
              fit: BoxFit.cover,
              excludeFromSemantics: true,
              frameBuilder: (_, child, frame, loaded) =>
                  loaded || frame != null ? child : monogram,
              errorBuilder: (_, _, _) => monogram,
            ),
    );
    final text = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        reservedLines(
          style: m.titleStyle,
          lines: m.titleLines,
          child: Text(
            article.title,
            style: m.titleStyle,
            maxLines: m.titleLines,
            overflow: TextOverflow.ellipsis,
          ),
        ),
        if (m.showExcerpt) ...[
          const SizedBox(height: 4),
          reservedLines(
            style: m.excerptStyle,
            lines: 2,
            child: Text(
              article.excerpt,
              style: m.excerptStyle,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
          ),
        ],
        const SizedBox(height: 4),
        Text(
          '${article.sourceName} · '
          '${formatArticleAge(article.publishedAt, DateTime.now())}',
          style: m.metaStyle,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
      ],
    );
    return Pressable(
      onTap: () => openExternalLink(Uri.parse(article.link)),
      pressedScale: 0.99,
      borderRadius: m.mediaRadius,
      semanticLabel:
          '${article.title}, ${article.sourceName}, '
          '${formatArticleFullDate(article.publishedAt)}',
      child: ExcludeSemantics(
        child: variant == ArticleCardVariant.row
            ? Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  SizedBox.square(dimension: m.rowMediaSize, child: image),
                  SizedBox(width: m.mediaGap),
                  Expanded(child: text),
                ],
              )
            : Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  AspectRatio(aspectRatio: 16 / 9, child: image),
                  SizedBox(height: m.mediaGap),
                  text,
                ],
              ),
      ),
    );
  }
}
