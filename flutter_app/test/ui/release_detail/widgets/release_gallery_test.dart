import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';
import 'package:vinylmania/domain/models/catalog/catalog_image.dart';
import 'package:vinylmania/ui/release_detail/widgets/gallery_viewer.dart';
import 'package:vinylmania/ui/release_detail/widgets/release_gallery.dart';

import '../../../helpers/fixtures/catalog_fixtures.dart';
import '../../../helpers/pump_screen.dart';

Widget _gallery(List<CatalogImage> images) => Padding(
  padding: const EdgeInsets.all(16),
  child: ReleaseGallery(images: images, alt: 'Master Of Puppets'),
);

void main() {
  testWidgets('no images: a labelled placeholder', (tester) async {
    await pumpScreen(tester, _gallery(const []));
    expect(find.text('No cover image available'), findsOneWidget);
    expect(
      find.bySemanticsLabel('No cover image available for Master Of Puppets'),
      findsOneWidget,
    );
  });

  testWidgets('thumbnails select; a single image shows none', (tester) async {
    await pumpScreen(tester, _gallery(release.images));
    expect(find.bySemanticsLabel('Show image 1 of 2'), findsOneWidget);
    await tester.tap(find.bySemanticsLabel('Show image 2 of 2'));
    await tester.pump();
    expect(
      tester.getSemantics(find.bySemanticsLabel('Show image 2 of 2')),
      isSemantics(isButton: true, isSelected: true),
    );
    await expectA11yGuidelines(tester);

    await pumpScreen(tester, _gallery(master.images));
    expect(find.bySemanticsLabel(RegExp('Show image')), findsNothing);
  });

  group('fullscreen viewer', () {
    Future<void> open(WidgetTester tester, {Size size = compactSize}) async {
      await pumpScreen(tester, _gallery(release.images), size: size);
      await tester.tap(
        find.bySemanticsLabel('View Master Of Puppets fullscreen'),
      );
      await tester.pumpAndSettle();
      expect(find.bySemanticsLabel('Close'), findsOneWidget);
    }

    testWidgets('Close button closes it', (tester) async {
      await open(tester);
      await expectA11yGuidelines(tester);
      await tester.tap(find.bySemanticsLabel('Close'));
      await tester.pumpAndSettle();
      expect(find.bySemanticsLabel('Close'), findsNothing);
    });

    testWidgets('Esc closes it (desktop)', (tester) async {
      await open(tester, size: expandedSize);
      await tester.sendKeyEvent(LogicalKeyboardKey.escape);
      await tester.pumpAndSettle();
      expect(find.bySemanticsLabel('Close'), findsNothing);
    });

    testWidgets('swipe down closes it', (tester) async {
      await open(tester);
      await tester.fling(
        find.byKey(const ValueKey('gallery-viewer-pages')),
        const Offset(0, 400),
        1500,
      );
      await tester.pumpAndSettle();
      expect(find.bySemanticsLabel('Close'), findsNothing);
    });

    testWidgets('reduced motion: opens and steps without animating', (
      tester,
    ) async {
      await pumpScreen(
        tester,
        _gallery(release.images),
        size: expandedSize,
        disableAnimations: true,
      );
      await tester.tap(
        find.bySemanticsLabel('View Master Of Puppets fullscreen'),
      );
      await tester.pump();
      await tester.pump();
      final fade = tester.widget<FadeTransition>(
        find
            .ancestor(
              of: find.byType(GalleryViewer),
              matching: find.byType(FadeTransition),
            )
            .first,
      );
      expect(fade.opacity.value, 1);

      await tester.sendKeyEvent(LogicalKeyboardKey.arrowRight);
      await tester.pump();
      final pages = tester.widget<PageView>(
        find.byKey(const ValueKey('gallery-viewer-pages')),
      );
      expect(pages.controller!.page, 1);
    });

    testWidgets('arrow keys step and the gallery keeps the selection', (
      tester,
    ) async {
      await open(tester, size: expandedSize);
      await tester.sendKeyEvent(LogicalKeyboardKey.arrowRight);
      await tester.pumpAndSettle();
      await tester.sendKeyEvent(LogicalKeyboardKey.escape);
      await tester.pumpAndSettle();
      expect(
        tester.getSemantics(find.bySemanticsLabel('Show image 2 of 2')),
        isSemantics(isSelected: true),
      );
    });
  });
}
