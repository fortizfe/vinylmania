import 'package:material_ui/material_ui.dart';

import '../../core/widgets/skeleton.dart';
import '../../core/widgets/vm_card.dart';

/// `SearchResultCard` shape while loading: same cell, cover, three lines and
/// the actions row.
class SearchResultCardSkeleton extends StatelessWidget {
  const SearchResultCardSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return VmCard(
      padding: const EdgeInsets.all(8),
      child: LayoutBuilder(
        builder: (context, constraints) => Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Expanded(
              child: Skeleton(
                height: double.infinity,
                radius: BorderRadius.all(Radius.circular(8)),
              ),
            ),
            const SizedBox(height: 8),
            Skeleton(width: constraints.maxWidth * 0.75, height: 14),
            const SizedBox(height: 6),
            Skeleton(width: constraints.maxWidth * 0.5, height: 12),
            const SizedBox(height: 6),
            Skeleton(width: constraints.maxWidth * 0.25, height: 12),
            const SizedBox(height: 4),
            const SizedBox(height: kMinInteractiveDimension),
          ],
        ),
      ),
    );
  }
}
