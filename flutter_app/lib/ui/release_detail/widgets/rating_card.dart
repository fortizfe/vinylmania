import 'package:material_ui/material_ui.dart';

import '../../../domain/models/catalog/community_stats.dart';
import '../../core/widgets/pressable.dart';
import '../../core/widgets/release_rating_badge.dart';
import '../../core/widgets/star_rating.dart';
import '../../core/widgets/vm_card.dart';
import '../view_models/save_status.dart';
import 'error_line.dart';
import 'section_heading.dart';

/// Web `RatingCard`: the Discogs community rating + have/want, and the
/// personal rating (editable stars in the library/wishlist, plain text
/// otherwise). A failed save offers "Reintentar".
class RatingCard extends StatelessWidget {
  const RatingCard({super.key, required this.community, this.personal});

  final CommunityStats? community;
  final ({
    int value,
    SaveStatus status,
    ValueChanged<int> onChanged,
    VoidCallback onRetry,
  })?
  personal;

  /// Both halves keep this height in every state (web `min-h-[7.5rem]`).
  static const minHeight = 120.0;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final label = theme.textTheme.labelLarge?.copyWith(
      color: theme.colorScheme.onSurface,
    );
    final muted = TextStyle(color: theme.colorScheme.onSurfaceVariant);
    final rating = community?.rating;
    final unrated = rating == null || rating.count <= 0;
    final mine = personal;

    final communityHalf = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      spacing: 8,
      children: [
        Text('Comunidad de Discogs', style: label),
        Row(
          spacing: 8,
          children: [
            ReleaseRatingBadge(
              average: rating?.average,
              count: rating?.count ?? 0,
            ),
            Text(
              unrated ? 'Sin valoraciones' : '(${rating.count})',
              style: muted,
            ),
          ],
        ),
        if (community case final c?)
          Text('${c.have} lo tienen · ${c.want} lo quieren', style: muted),
      ],
    );

    final personalHalf = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      spacing: 8,
      children: [
        Text('Tu valoración', style: label),
        if (mine == null)
          Text('Sin valorar', style: muted)
        else ...[
          StarRating(
            value: mine.value,
            onChanged: mine.onChanged,
            saving: mine.status == SaveStatus.saving,
            label: 'Tu valoración',
          ),
          if (mine.status == SaveStatus.failed)
            Wrap(
              crossAxisAlignment: WrapCrossAlignment.center,
              spacing: 8,
              children: [
                const ErrorLine('No se pudo guardar tu valoración.'),
                Pressable(
                  onTap: mine.onRetry,
                  borderRadius: const BorderRadius.all(Radius.circular(6)),
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(
                      minHeight: kMinInteractiveDimension,
                      minWidth: kMinInteractiveDimension,
                    ),
                    child: Center(
                      widthFactor: 1,
                      child: Text(
                        'Reintentar',
                        style: TextStyle(
                          color: theme.colorScheme.error,
                          fontWeight: FontWeight.w500,
                          decoration: TextDecoration.underline,
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ),
        ],
      ],
    );

    return VmCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        spacing: 12,
        children: [
          const SectionHeading('Valoración'),
          ConstrainedBox(
            constraints: const BoxConstraints(minHeight: minHeight),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              spacing: 16,
              children: [communityHalf, personalHalf],
            ),
          ),
        ],
      ),
    );
  }
}
