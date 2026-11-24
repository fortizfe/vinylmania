import 'package:material_ui/material_ui.dart';

import '../../../domain/models/collection_stats/artist_count.dart';
import '../../core/widgets/vm_card.dart';
import '../stats_format.dart';
import 'stats_heading.dart';

/// Most-present artist call-out above the numbered top-artists list.
class TopArtistsCard extends StatelessWidget {
  const TopArtistsCard({super.key, required this.artists, this.mostPresent});

  final List<ArtistCount> artists;
  final ArtistCount? mostPresent;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final muted = TextStyle(color: scheme.onSurfaceVariant);
    final strong = TextStyle(color: scheme.onSurface);
    final top = mostPresent;

    return VmCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const StatsHeading('Top artists'),
          const SizedBox(height: 12),
          if (artists.isEmpty)
            Text(
              'No artist data yet — sync your collection to populate this.',
              style: muted,
            )
          else ...[
            if (top != null)
              MergeSemantics(
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    color: scheme.surfaceContainerHigh,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Padding(
                    padding: const EdgeInsets.all(12),
                    child: Wrap(
                      spacing: 12,
                      runSpacing: 4,
                      crossAxisAlignment: WrapCrossAlignment.center,
                      children: [
                        DecoratedBox(
                          decoration: BoxDecoration(
                            color: scheme.primaryContainer,
                            borderRadius: BorderRadius.circular(999),
                          ),
                          child: Padding(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 8,
                              vertical: 2,
                            ),
                            child: Text(
                              'Most present',
                              style: theme.textTheme.labelSmall?.copyWith(
                                color: scheme.onPrimaryContainer,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ),
                        ),
                        Text(
                          top.name,
                          style: theme.textTheme.titleMedium?.copyWith(
                            color: scheme.onSurface,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        Text(
                          'on ${formatCount(top.count)} ${records(top.count)}',
                          style: muted,
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            const SizedBox(height: 8),
            for (final (i, artist) in artists.indexed)
              MergeSemantics(
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 6),
                  child: Row(
                    children: [
                      ConstrainedBox(
                        constraints: const BoxConstraints(minWidth: 24),
                        child: Text(
                          '${i + 1}',
                          textAlign: TextAlign.end,
                          style: muted,
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          artist.name,
                          overflow: TextOverflow.ellipsis,
                          style: strong,
                        ),
                      ),
                      const SizedBox(width: 12),
                      Text(
                        formatCount(artist.count),
                        style: strong.copyWith(fontWeight: FontWeight.w500),
                      ),
                    ],
                  ),
                ),
              ),
          ],
        ],
      ),
    );
  }
}
