import 'package:material_ui/material_ui.dart';

import '../../../domain/models/library/library_entry.dart';
import '../../core/widgets/cover_image.dart';
import '../../core/widgets/release_rating_badge.dart';
import '../../core/widgets/vm_card.dart';
import 'record_unavailable_card.dart';

/// Web `RecordCard`: square cover with the community rating, title and
/// primary artist.
class RecordCard extends StatelessWidget {
  const RecordCard({super.key, required this.entry, required this.onTap});

  final LibraryEntry entry;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final release = entry.release;
    if (release == null || !entry.isCatalogAvailable) {
      return RecordUnavailableCard(actionLabel: 'Open record', onOpen: onTap);
    }
    final theme = Theme.of(context);
    final rating = release.community?.rating;
    return VmCard(
      padding: const EdgeInsets.all(12),
      onTap: onTap,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
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
    );
  }
}
