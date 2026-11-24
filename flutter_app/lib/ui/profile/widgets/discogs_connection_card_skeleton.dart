import 'package:material_ui/material_ui.dart';

import '../../core/widgets/skeleton.dart';
import '../../core/widgets/vm_card.dart';

/// Shape of [DiscogsConnectionCard] (heading, status line, action) at the
/// same minimum height, so resolving the status never shifts the layout.
class DiscogsConnectionCardSkeleton extends StatelessWidget {
  const DiscogsConnectionCardSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return VmCard(
      child: ConstrainedBox(
        constraints: const BoxConstraints(minHeight: 144),
        child: const Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Skeleton(
                  width: 40,
                  height: 40,
                  radius: BorderRadius.all(Radius.circular(20)),
                ),
                SizedBox(width: 12),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Skeleton(width: 96, height: 16),
                    SizedBox(height: 8),
                    Skeleton(width: 192, height: 12),
                  ],
                ),
              ],
            ),
            SizedBox(height: 16),
            Skeleton(width: 144, height: 16),
            SizedBox(height: 16),
            Skeleton(width: 224, height: kMinInteractiveDimension),
          ],
        ),
      ),
    );
  }
}
