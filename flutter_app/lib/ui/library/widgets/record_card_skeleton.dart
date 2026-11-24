import 'package:material_ui/material_ui.dart';

import '../../core/widgets/skeleton.dart';
import '../../core/widgets/vm_card.dart';

/// Placeholder in the exact shape of a `RecordCard` (cover, title, artist),
/// plus [footerHeight] for cards with an action row (`WishlistCard`).
class RecordCardSkeleton extends StatelessWidget {
  const RecordCardSkeleton({super.key, this.footerHeight = 0});

  final double footerHeight;

  @override
  Widget build(BuildContext context) {
    final text = MediaQuery.textScalerOf(context);
    return VmCard(
      padding: const EdgeInsets.all(12),
      child: LayoutBuilder(
        builder: (context, constraints) => Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            const AspectRatio(aspectRatio: 1, child: Skeleton()),
            const SizedBox(height: 8),
            // Line heights of the title (16 × 1.5) and artist (14 × 1.43).
            _line(constraints.maxWidth * 0.75, text.scale(24)),
            _line(constraints.maxWidth * 0.5, text.scale(20)),
            SizedBox(height: footerHeight),
          ],
        ),
      ),
    );
  }

  static Widget _line(double width, double height) => SizedBox(
    height: height,
    child: Align(
      alignment: Alignment.centerLeft,
      child: Skeleton(width: width, height: height * 0.66),
    ),
  );
}
