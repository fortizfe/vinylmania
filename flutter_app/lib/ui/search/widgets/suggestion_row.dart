import 'package:material_ui/material_ui.dart';

import '../../../domain/models/catalog/catalog_suggestion.dart';
import '../../core/widgets/cover_image.dart';
import '../../core/widgets/pressable.dart';
import '../../core/widgets/vm_badge.dart';

/// One suggestion: thumbnail, title, "artist · year · format" and a kind
/// chip in text ("Album" / "Artist"), never colour alone.
class SuggestionRow extends StatelessWidget {
  const SuggestionRow({
    super.key,
    required this.suggestion,
    required this.onTap,
  });

  final CatalogSuggestion suggestion;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final s = suggestion;
    final kind = s.resultType == 'artist' ? 'Artist' : 'Album';
    final detail = [
      ?s.artist,
      if (s.year != null) '${s.year}',
      ?s.format,
    ].join(' · ');
    return Pressable(
      onTap: onTap,
      pressedScale: 0.99,
      borderRadius: const BorderRadius.all(Radius.circular(8)),
      semanticLabel: [
        s.title,
        detail,
        kind,
      ].where((p) => p.isNotEmpty).join(', '),
      child: ExcludeSemantics(
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: 56),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            child: Row(
              children: [
                SizedBox.square(
                  dimension: 40,
                  child: CoverImage(
                    url: s.thumbnailUrl,
                    semanticLabel: s.title,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        s.title,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(color: theme.colorScheme.onSurface),
                      ),
                      if (detail.isNotEmpty)
                        Text(
                          detail,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: theme.textTheme.bodySmall?.copyWith(
                            color: theme.colorScheme.onSurfaceVariant,
                          ),
                        ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                VmBadge(label: kind),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
