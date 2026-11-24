import 'package:material_ui/material_ui.dart';

import '../../../domain/models/wantlist/want_entry.dart';
import '../../core/widgets/cover_image.dart';
import '../../core/widgets/pressable.dart';
import '../../core/widgets/release_rating_badge.dart';
import '../../core/widgets/vm_button.dart';
import '../../core/widgets/vm_card.dart';
import '../../library/widgets/record_unavailable_card.dart';

/// Web `WantlistCard`: cover with the community rating (never the personal
/// one), title, primary artist, and a remove button. Stays removable when
/// the catalog data is unavailable.
class WishlistCard extends StatelessWidget {
  const WishlistCard({
    super.key,
    required this.entry,
    required this.onOpen,
    required this.onRemove,
  });

  final WantEntry entry;
  final VoidCallback onOpen;
  final VoidCallback onRemove;

  @override
  Widget build(BuildContext context) {
    final remove = Align(
      alignment: Alignment.centerRight,
      child: VmButton.icon(
        onPressed: onRemove,
        label: 'Remove from wishlist',
        icon: Icons.delete_outline,
      ),
    );
    final release = entry.release;
    if (release == null || !entry.isCatalogAvailable) {
      return RecordUnavailableCard(
        actionLabel: 'Open release',
        onOpen: onOpen,
        footer: remove,
      );
    }
    final theme = Theme.of(context);
    final rating = release.community?.rating;
    return VmCard(
      padding: const EdgeInsets.all(12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          Pressable(
            onTap: onOpen,
            pressedScale: 0.99,
            borderRadius: const BorderRadius.all(Radius.circular(8)),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Stack(
                  children: [
                    ExcludeSemantics(
                      child: CoverImage(
                        url: release.images.firstOrNull?.url,
                        semanticLabel: release.title,
                      ),
                    ),
                    Positioned(
                      top: 8,
                      right: 8,
                      child: ReleaseRatingBadge(
                        average: rating?.average,
                        count: rating?.count ?? 0,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Text(
                  release.title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: theme.textTheme.bodyLarge?.copyWith(
                    fontWeight: FontWeight.w600,
                    color: theme.colorScheme.onSurface,
                  ),
                ),
                if (release.artists.firstOrNull?.name case final artist?)
                  Text(
                    artist,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: theme.textTheme.bodyMedium?.copyWith(
                      color: theme.colorScheme.onSurfaceVariant,
                    ),
                  ),
              ],
            ),
          ),
          remove,
        ],
      ),
    );
  }
}
