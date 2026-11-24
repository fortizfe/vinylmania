import 'package:material_ui/material_ui.dart';

import '../../core/open_external_link.dart';
import '../../core/widgets/pressable.dart';
import '../../core/widgets/skeleton.dart';
import '../../core/widgets/vm_card.dart';
import '../view_models/streaming_links_loader.dart';
import 'section_heading.dart';

/// Display data per platform id (web `PLATFORM_META`); unknown platforms
/// are skipped so the app needn't ship in lockstep with the backend.
const _platforms = {
  'apple_music': (label: 'Apple Music', semantics: 'Escuchar en Apple Music'),
  'spotify': (label: 'Spotify', semantics: 'Escuchar en Spotify'),
};

/// Web `StreamingLinksSection` ("Escúchalo en streaming"): a fixed-height
/// skeleton while resolving, the links when any, nothing otherwise.
class StreamingLinksSection extends StatelessWidget {
  const StreamingLinksSection({super.key, required this.loader});

  final StreamingLinksLoader loader;

  /// Heading line (24) + gap (12) + one 48 px link row: skeleton and links
  /// occupy the same height.
  static const _headingHeight = 24.0;

  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: loader,
    builder: (context, _) {
      if (loader.loading) {
        return VmCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            spacing: 12,
            children: const [
              Skeleton(width: 176, height: _headingHeight),
              Skeleton(width: 144, height: kMinInteractiveDimension),
            ],
          ),
        );
      }
      final links = [
        for (final l in loader.links)
          if (_platforms[l.platform] case final meta?) (link: l, meta: meta),
      ];
      if (links.isEmpty) return const SizedBox.shrink();
      final scheme = Theme.of(context).colorScheme;
      return VmCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          spacing: 12,
          children: [
            ConstrainedBox(
              constraints: const BoxConstraints(minHeight: _headingHeight),
              child: const SectionHeading('Escúchalo en streaming'),
            ),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                for (final (:link, :meta) in links)
                  Semantics(
                    link: true,
                    child: Pressable(
                      onTap: () => openExternalLink(Uri.parse(link.url)),
                      semanticLabel: meta.semantics,
                      borderRadius: const BorderRadius.all(Radius.circular(8)),
                      child: ExcludeSemantics(
                        child: Container(
                          constraints: const BoxConstraints(
                            minHeight: kMinInteractiveDimension,
                          ),
                          padding: const EdgeInsets.symmetric(horizontal: 16),
                          decoration: BoxDecoration(
                            color: scheme.surface,
                            border: Border.all(color: scheme.outline),
                            borderRadius: const BorderRadius.all(
                              Radius.circular(8),
                            ),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            spacing: 8,
                            children: [
                              Icon(
                                Icons.music_note,
                                size: 20,
                                color: scheme.onSurface,
                              ),
                              Flexible(
                                child: Text(
                                  meta.label,
                                  style: TextStyle(
                                    color: scheme.onSurface,
                                    fontWeight: FontWeight.w500,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ),
              ],
            ),
          ],
        ),
      );
    },
  );
}
