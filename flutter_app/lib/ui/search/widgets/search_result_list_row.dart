import 'package:material_ui/material_ui.dart';

import '../../../domain/models/catalog/catalog_search_result.dart';
import '../../core/widgets/cover_image.dart';
import '../../core/widgets/pressable.dart';
import '../../core/widgets/release_rating_badge.dart';
import '../../core/widgets/vm_badge.dart';
import '../../core/widgets/vm_card.dart';
import 'result_card_actions.dart';
import '../../core/widgets/badge_tone.dart';

/// Web `SearchResultListRow`: thumbnail + rating, title, artist, then
/// formats, country, year and labels; actions (or "Multiple editions") on
/// the right.
class SearchResultListRow extends StatelessWidget {
  const SearchResultListRow({
    super.key,
    required this.result,
    required this.onOpen,
    this.actions,
  });

  final CatalogSearchResult result;
  final VoidCallback onOpen;

  /// Null for masters.
  final ResultCardActions? actions;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final r = result;
    final isMaster = r.resultType == 'master';
    final thumb = MediaQuery.sizeOf(context).width >= 840 ? 80.0 : 64.0;
    final secondary = theme.textTheme.bodySmall?.copyWith(
      color: theme.colorScheme.onSurfaceVariant,
    );
    final details = [
      if (r.formats.isNotEmpty) r.formats.join(', '),
      ?r.country,
      if (r.year != null) '${r.year}',
      if (r.labels.isNotEmpty) r.labels.join(', '),
    ];
    return VmCard(
      padding: const EdgeInsets.all(8),
      child: Row(
        children: [
          Expanded(
            child: Pressable(
              onTap: onOpen,
              pressedScale: 0.99,
              borderRadius: const BorderRadius.all(Radius.circular(8)),
              child: Row(
                children: [
                  SizedBox.square(
                    dimension: thumb,
                    child: Stack(
                      children: [
                        CoverImage(url: r.thumbnailUrl, semanticLabel: r.title),
                        if (!isMaster)
                          Positioned(
                            top: 0,
                            right: 0,
                            child: ReleaseRatingBadge(
                              average: r.communityRating?.average,
                              count: r.communityRating?.count ?? 0,
                            ),
                          ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          r.title,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: theme.textTheme.bodyMedium?.copyWith(
                            color: theme.colorScheme.onSurface,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        if (r.artist != null)
                          Text(
                            r.artist!,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: secondary,
                          ),
                        if (!isMaster && details.isNotEmpty)
                          Wrap(
                            spacing: 8,
                            children: [
                              for (final d in details)
                                Text(d, style: secondary),
                            ],
                          ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(width: 8),
          actions ??
              const VmBadge(label: 'Multiple editions', tone: BadgeTone.muted),
        ],
      ),
    );
  }
}
