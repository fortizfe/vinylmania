import 'package:material_ui/material_ui.dart';

import '../../../domain/models/library/library_entry.dart';
import '../../core/widgets/cover_image.dart';
import '../../core/widgets/release_rating_badge.dart';
import '../../core/widgets/vm_card.dart';
import 'record_unavailable_card.dart';

/// Web `RecordListRow`: thumbnail with the community rating, then title,
/// all artists and the format · country · year · label line.
class RecordListRow extends StatelessWidget {
  const RecordListRow({super.key, required this.entry, required this.onTap});

  final LibraryEntry entry;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final release = entry.release;
    if (release == null || !entry.isCatalogAvailable) {
      return RecordUnavailableCard(actionLabel: 'Open record', onOpen: onTap);
    }
    final theme = Theme.of(context);
    final muted = theme.textTheme.bodyMedium?.copyWith(
      color: theme.colorScheme.onSurfaceVariant,
    );
    final rating = release.community?.rating;
    final artists = release.artists.map((a) => a.name).join(', ');
    final meta = [
      release.formats.map((f) => f.name).join(', '),
      release.country ?? '',
      if (release.year case final year?) '$year',
      release.labels.map((l) => l.name).join(', '),
    ].where((part) => part.isNotEmpty).join(' · ');
    final thumb = MediaQuery.sizeOf(context).width < 640 ? 64.0 : 80.0;

    return VmCard(
      padding: const EdgeInsets.all(12),
      onTap: onTap,
      child: Row(
        children: [
          SizedBox(
            width: thumb + 6,
            height: thumb + 6,
            child: Stack(
              children: [
                Positioned(
                  left: 0,
                  bottom: 0,
                  width: thumb,
                  height: thumb,
                  child: ExcludeSemantics(
                    child: CoverImage(
                      url: release.images.firstOrNull?.url,
                      semanticLabel: release.title,
                    ),
                  ),
                ),
                Positioned(
                  top: 0,
                  right: 0,
                  child: ReleaseRatingBadge(
                    average: rating?.average,
                    count: rating?.count ?? 0,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  release.title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: theme.textTheme.bodyLarge?.copyWith(
                    fontWeight: FontWeight.w600,
                    color: theme.colorScheme.onSurface,
                  ),
                ),
                if (artists.isNotEmpty)
                  Text(
                    artists,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: muted,
                  ),
                if (meta.isNotEmpty) Text(meta, maxLines: 2, style: muted),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
