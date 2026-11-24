import 'package:material_ui/material_ui.dart';

import '../../../domain/models/catalog/catalog_image.dart';
import '../../core/widgets/cover_image.dart';
import '../../core/widgets/pressable.dart';
import 'gallery_thumbnail.dart';
import 'gallery_viewer.dart';

/// Web `ReleaseImageGallery`: the selected image (tap → fullscreen viewer)
/// with a thumbnail column beside it when there is more than one image.
class ReleaseGallery extends StatefulWidget {
  const ReleaseGallery({super.key, required this.images, required this.alt});

  final List<CatalogImage> images;
  final String alt;

  @override
  State<ReleaseGallery> createState() => _ReleaseGalleryState();
}

class _ReleaseGalleryState extends State<ReleaseGallery> {
  late int _selected = widget.images
      .indexWhere((i) => i.imageType == 'primary')
      .clamp(0, widget.images.length);

  Future<void> _openViewer() async {
    final index = await GalleryViewer.show(
      context,
      images: widget.images,
      initialIndex: _selected,
      alt: widget.alt,
    );
    if (mounted) setState(() => _selected = index);
  }

  @override
  Widget build(BuildContext context) {
    final images = widget.images;
    if (images.isEmpty) {
      final scheme = Theme.of(context).colorScheme;
      return Semantics(
        image: true,
        label: 'No cover image available for ${widget.alt}',
        child: ExcludeSemantics(
          child: AspectRatio(
            aspectRatio: 1,
            child: DecoratedBox(
              decoration: BoxDecoration(
                color: scheme.surfaceContainerHigh,
                borderRadius: const BorderRadius.all(Radius.circular(6)),
              ),
              child: Center(
                child: Text(
                  'No cover image available',
                  style: TextStyle(color: scheme.onSurfaceVariant),
                ),
              ),
            ),
          ),
        ),
      );
    }
    final main = Pressable(
      onTap: _openViewer,
      pressedScale: 0.99,
      semanticLabel: 'View ${widget.alt} fullscreen',
      borderRadius: const BorderRadius.all(Radius.circular(8)),
      child: ExcludeSemantics(
        child: CoverImage(url: images[_selected].url, semanticLabel: ''),
      ),
    );
    if (images.length == 1) return main;
    return AspectRatio(
      aspectRatio: 1,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        spacing: 12,
        children: [
          Expanded(child: main),
          SingleChildScrollView(
            child: Column(
              spacing: 8,
              children: [
                for (var i = 0; i < images.length; i++)
                  GalleryThumbnail(
                    url: images[i].url,
                    label: 'Show image ${i + 1} of ${images.length}',
                    selected: i == _selected,
                    onTap: () => setState(() => _selected = i),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
