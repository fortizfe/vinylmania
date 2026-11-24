import 'package:material_ui/material_ui.dart';

import '../../core/widgets/skeleton.dart';
import 'article_card_metrics.dart';
import 'article_card_variant.dart';
import 'reserved_lines.dart';

/// [ArticleCard]'s exact box while the news loads.
class ArticleCardSkeleton extends StatelessWidget {
  const ArticleCardSkeleton({
    super.key,
    this.variant = ArticleCardVariant.tile,
  });

  final ArticleCardVariant variant;

  @override
  Widget build(BuildContext context) {
    final m = ArticleCardMetrics.of(context, variant);
    final bar = variant == ArticleCardVariant.lead ? 24.0 : 14.0;
    Widget lines(TextStyle? style, int count, double height) => reservedLines(
      style: style,
      lines: count,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.spaceEvenly,
        children: [
          for (var i = 0; i < count; i++)
            FractionallySizedBox(
              widthFactor: i == count - 1 && count > 1 ? 2 / 3 : 1,
              child: Skeleton(height: height),
            ),
        ],
      ),
    );
    final text = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        lines(m.titleStyle, m.titleLines, bar),
        if (m.showExcerpt) ...[
          const SizedBox(height: 4),
          lines(m.excerptStyle, 2, 12),
        ],
        const SizedBox(height: 4),
        reservedLines(
          style: m.metaStyle,
          lines: 1,
          child: const Align(
            alignment: Alignment.centerLeft,
            child: FractionallySizedBox(
              widthFactor: 1 / 3,
              child: Skeleton(height: 10),
            ),
          ),
        ),
      ],
    );
    final media = Skeleton(radius: m.mediaRadius);
    return variant == ArticleCardVariant.row
        ? Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              SizedBox.square(dimension: m.rowMediaSize, child: media),
              SizedBox(width: m.mediaGap),
              Expanded(child: text),
            ],
          )
        : Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              AspectRatio(aspectRatio: 16 / 9, child: media),
              SizedBox(height: m.mediaGap),
              text,
            ],
          );
  }
}
