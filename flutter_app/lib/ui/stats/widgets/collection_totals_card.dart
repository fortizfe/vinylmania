import 'package:material_ui/material_ui.dart';

import '../../../domain/models/collection_stats/artist_count.dart';
import '../../core/widgets/vm_card.dart';
import '../stats_format.dart';

/// Headline figures: records in the collection and the most-present artist.
class CollectionTotalsCard extends StatelessWidget {
  const CollectionTotalsCard({
    super.key,
    required this.totalRecords,
    this.mostPresentArtist,
  });

  final int totalRecords;
  final ArtistCount? mostPresentArtist;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final muted = TextStyle(
      color: theme.colorScheme.onSurfaceVariant,
      fontWeight: FontWeight.w500,
    );
    final artist = mostPresentArtist;
    return VmCard(
      child: Wrap(
        alignment: WrapAlignment.spaceBetween,
        crossAxisAlignment: WrapCrossAlignment.end,
        spacing: 16,
        runSpacing: 16,
        children: [
          MergeSemantics(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text('Records in your collection', style: muted),
                Text(
                  formatCount(totalRecords),
                  style: theme.textTheme.headlineLarge?.copyWith(
                    color: theme.colorScheme.onSurface,
                    fontFeatures: const [FontFeature.tabularFigures()],
                  ),
                ),
              ],
            ),
          ),
          if (artist != null)
            MergeSemantics(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text('Most-present artist', style: muted),
                  Text(
                    artist.name,
                    style: theme.textTheme.titleMedium?.copyWith(
                      color: theme.colorScheme.onSurface,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  Text(
                    'on ${formatCount(artist.count)} ${records(artist.count)}',
                    style: TextStyle(color: theme.colorScheme.onSurfaceVariant),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}
