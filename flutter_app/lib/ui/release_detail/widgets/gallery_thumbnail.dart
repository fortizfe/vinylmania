import 'package:material_ui/material_ui.dart';

import '../../core/widgets/pressable.dart';

/// One 48×48 thumbnail button; the selected one gets a primary ring and
/// the selected semantics flag (never color alone).
class GalleryThumbnail extends StatelessWidget {
  const GalleryThumbnail({
    super.key,
    required this.url,
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String url;
  final String label;
  final bool selected;
  final VoidCallback onTap;

  static const _radius = BorderRadius.all(Radius.circular(6));

  @override
  Widget build(BuildContext context) => Semantics(
    selected: selected,
    child: Pressable(
      onTap: onTap,
      semanticLabel: label,
      borderRadius: _radius,
      child: Container(
        width: kMinInteractiveDimension,
        height: kMinInteractiveDimension,
        decoration: BoxDecoration(
          borderRadius: _radius,
          border: Border.all(
            width: 2,
            color: selected
                ? Theme.of(context).colorScheme.primary
                : Colors.transparent,
          ),
        ),
        child: ClipRRect(
          borderRadius: _radius,
          child: Image.network(
            url,
            fit: BoxFit.cover,
            excludeFromSemantics: true,
            errorBuilder: (_, _, _) => ColoredBox(
              color: Theme.of(context).colorScheme.surfaceContainerHigh,
            ),
          ),
        ),
      ),
    ),
  );
}
