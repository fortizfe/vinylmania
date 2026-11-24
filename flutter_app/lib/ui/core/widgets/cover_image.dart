import 'package:material_ui/material_ui.dart';

/// Release cover in a fixed-ratio box; a neutral placeholder while loading,
/// without a url or when the image fails, so nothing shifts.
class CoverImage extends StatelessWidget {
  const CoverImage({
    super.key,
    this.url,
    required this.semanticLabel,
    this.aspectRatio = 1,
  });

  final String? url;
  final String semanticLabel;
  final double aspectRatio;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final placeholder = ColoredBox(
      color: scheme.surfaceContainerHigh,
      child: Center(
        child: Icon(Icons.album_outlined, color: scheme.onSurfaceVariant),
      ),
    );
    return Semantics(
      image: true,
      label: semanticLabel,
      child: AspectRatio(
        aspectRatio: aspectRatio,
        child: ClipRRect(
          borderRadius: const BorderRadius.all(Radius.circular(8)),
          child: url == null
              ? placeholder
              : Image.network(
                  url!,
                  fit: BoxFit.cover,
                  excludeFromSemantics: true,
                  frameBuilder: (_, child, frame, loaded) =>
                      loaded || frame != null ? child : placeholder,
                  errorBuilder: (_, _, _) => placeholder,
                ),
        ),
      ),
    );
  }
}
