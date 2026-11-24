import 'package:material_ui/material_ui.dart';

import '../../core/widgets/skeleton.dart';
import '../../core/widgets/vm_card.dart';

/// `SearchResultListRow` shape while loading.
class SearchResultListRowSkeleton extends StatelessWidget {
  const SearchResultListRowSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    final thumb = MediaQuery.sizeOf(context).width >= 840 ? 80.0 : 64.0;
    return VmCard(
      padding: const EdgeInsets.all(8),
      child: Row(
        children: [
          Skeleton(
            width: thumb,
            height: thumb,
            radius: const BorderRadius.all(Radius.circular(8)),
          ),
          const SizedBox(width: 16),
          const Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                FractionallySizedBox(
                  widthFactor: 0.75,
                  child: Skeleton(height: 14),
                ),
                SizedBox(height: 6),
                FractionallySizedBox(
                  widthFactor: 0.5,
                  child: Skeleton(height: 12),
                ),
                SizedBox(height: 6),
                FractionallySizedBox(
                  widthFactor: 0.6,
                  child: Skeleton(height: 12),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          const Skeleton(width: 104, height: kMinInteractiveDimension),
        ],
      ),
    );
  }
}
