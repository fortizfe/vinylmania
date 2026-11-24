import 'package:material_ui/material_ui.dart';

import '../../../domain/models/catalog/catalog_search_result.dart';
import '../../core/widgets/cover_image.dart';
import '../../core/widgets/pressable.dart';
import '../../core/widgets/release_rating_badge.dart';
import '../../core/widgets/vm_badge.dart';
import '../../core/widgets/vm_card.dart';
import 'result_card_actions.dart';
import '../../core/widgets/badge_tone.dart';

/// Web `SearchResultCard`: cover + rating badge, title, artist, year and
/// first format; the add actions, or "Multiple editions" for a master.
/// The cover absorbs the cell's spare height, so text never overflows.
class SearchResultCard extends StatelessWidget {
  const SearchResultCard({
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
    final format = r.formats.isEmpty ? null : r.formats.first;
    TextStyle? secondary(TextStyle? s) =>
        s?.copyWith(color: theme.colorScheme.onSurfaceVariant);
    return VmCard(
      padding: const EdgeInsets.all(8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Pressable(
              onTap: onOpen,
              pressedScale: 0.99,
              borderRadius: const BorderRadius.all(Radius.circular(8)),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Center(
                      child: Stack(
                        children: [
                          CoverImage(
                            url: r.thumbnailUrl,
                            semanticLabel: r.title,
                          ),
                          Positioned(
                            top: 8,
                            right: 8,
                            child: ReleaseRatingBadge(
                              average: r.communityRating?.average,
                              count: r.communityRating?.count ?? 0,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    r.title,
                    maxLines: 1,
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
                      style: secondary(theme.textTheme.bodySmall),
                    ),
                  Text(
                    [
                      if (r.year != null) '${r.year}',
                      if (!isMaster && format != null) format,
                    ].join(' · '),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: secondary(theme.textTheme.bodySmall),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 4),
          SizedBox(
            height: kMinInteractiveDimension,
            child: Align(
              alignment: Alignment.centerLeft,
              child:
                  actions ??
                  const VmBadge(
                    label: 'Multiple editions',
                    tone: BadgeTone.muted,
                  ),
            ),
          ),
        ],
      ),
    );
  }
}
