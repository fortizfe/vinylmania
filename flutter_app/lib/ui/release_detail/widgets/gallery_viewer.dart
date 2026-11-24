import 'package:flutter/services.dart';
import 'package:material_ui/material_ui.dart';

import '../../../domain/models/catalog/catalog_image.dart';
import '../../core/theme/motion_tokens.dart';
import '../../core/theme/stone.dart';
import '../../core/widgets/vm_button.dart';
import 'gallery_thumbnail.dart';

/// Web `GalleryFullscreenViewer`: pinch-zoomable images, horizontal swipe or
/// ←/→ between them, thumbnails, and Close / Esc / swipe-down to dismiss.
class GalleryViewer extends StatefulWidget {
  const GalleryViewer({
    super.key,
    required this.images,
    required this.initialIndex,
    required this.alt,
  });

  final List<CatalogImage> images;
  final int initialIndex;
  final String alt;

  /// Resolves with the index on screen when the viewer closed.
  static Future<int> show(
    BuildContext context, {
    required List<CatalogImage> images,
    required int initialIndex,
    required String alt,
  }) async {
    final reduceMotion = MediaQuery.disableAnimationsOf(context);
    final index = await showGeneralDialog<int>(
      context: context,
      barrierDismissible: false,
      barrierColor: Stone.c950.withValues(alpha: 0.9),
      transitionDuration: reduceMotion
          ? Duration.zero
          : MotionTokens.of(context).fade,
      transitionBuilder: (_, animation, _, child) =>
          FadeTransition(opacity: animation, child: child),
      pageBuilder: (_, _, _) =>
          GalleryViewer(images: images, initialIndex: initialIndex, alt: alt),
    );
    return index ?? initialIndex;
  }

  @override
  State<GalleryViewer> createState() => _GalleryViewerState();
}

class _GalleryViewerState extends State<GalleryViewer> {
  late int _index = widget.initialIndex;
  late final _pages = PageController(initialPage: widget.initialIndex);
  final _zoom = TransformationController();
  bool _zoomed = false;

  @override
  void initState() {
    super.initState();
    _zoom.addListener(() {
      final zoomed = _zoom.value.getMaxScaleOnAxis() > 1.01;
      if (zoomed != _zoomed) setState(() => _zoomed = zoomed);
    });
  }

  @override
  void dispose() {
    _pages.dispose();
    _zoom.dispose();
    super.dispose();
  }

  void _close() => Navigator.of(context).pop(_index);

  void _goTo(int index) {
    if (index < 0 || index >= widget.images.length) return;
    if (MediaQuery.disableAnimationsOf(context)) {
      _pages.jumpToPage(index);
    } else {
      final motion = MotionTokens.of(context);
      _pages.animateToPage(
        index,
        duration: motion.drawer,
        curve: motion.easeOut,
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final images = widget.images;
    return CallbackShortcuts(
      bindings: {
        const SingleActivator(LogicalKeyboardKey.escape): _close,
        const SingleActivator(LogicalKeyboardKey.arrowRight): () =>
            _goTo(_index + 1),
        const SingleActivator(LogicalKeyboardKey.arrowLeft): () =>
            _goTo(_index - 1),
      },
      child: Focus(
        autofocus: true,
        child: Semantics(
          scopesRoute: true,
          explicitChildNodes: true,
          namesRoute: true,
          label: '${widget.alt} — fullscreen image viewer',
          child: SafeArea(
            child: Stack(
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 72, 16, 16),
                  child: Row(
                    spacing: 12,
                    children: [
                      Expanded(
                        child: GestureDetector(
                          onVerticalDragEnd: _zoomed
                              ? null
                              : (d) {
                                  if ((d.primaryVelocity ?? 0) > 700) _close();
                                },
                          child: PageView.builder(
                            key: const ValueKey('gallery-viewer-pages'),
                            controller: _pages,
                            physics: _zoomed
                                ? const NeverScrollableScrollPhysics()
                                : null,
                            itemCount: images.length,
                            onPageChanged: (i) {
                              _zoom.value = Matrix4.identity();
                              setState(() => _index = i);
                            },
                            itemBuilder: (_, i) => InteractiveViewer(
                              transformationController: i == _index
                                  ? _zoom
                                  : null,
                              maxScale: 4,
                              child: Center(
                                child: Image.network(
                                  images[i].url,
                                  fit: BoxFit.contain,
                                  semanticLabel: widget.alt,
                                  errorBuilder: (_, _, _) => const Icon(
                                    Icons.album_outlined,
                                    size: 96,
                                    color: Stone.c400,
                                  ),
                                ),
                              ),
                            ),
                          ),
                        ),
                      ),
                      if (images.length > 1)
                        SingleChildScrollView(
                          child: Column(
                            spacing: 8,
                            children: [
                              for (var i = 0; i < images.length; i++)
                                GalleryThumbnail(
                                  url: images[i].url,
                                  label:
                                      'Show image ${i + 1} of ${images.length}',
                                  selected: i == _index,
                                  onTap: () => _goTo(i),
                                ),
                            ],
                          ),
                        ),
                    ],
                  ),
                ),
                Positioned(
                  top: 16,
                  right: 16,
                  child: Material(
                    type: MaterialType.transparency,
                    child: DecoratedBox(
                      decoration: BoxDecoration(
                        color: Theme.of(context).colorScheme.surface,
                        borderRadius: const BorderRadius.all(
                          Radius.circular(12),
                        ),
                      ),
                      child: VmButton.icon(
                        onPressed: _close,
                        label: 'Close',
                        icon: Icons.close,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
