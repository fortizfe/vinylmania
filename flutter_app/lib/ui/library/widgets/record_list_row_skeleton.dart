import 'package:material_ui/material_ui.dart';

import '../../core/widgets/skeleton.dart';
import '../../core/widgets/vm_card.dart';

/// Placeholder in the shape of a `RecordListRow`.
class RecordListRowSkeleton extends StatelessWidget {
  const RecordListRowSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    final thumb = MediaQuery.sizeOf(context).width < 640 ? 64.0 : 80.0;
    final text = MediaQuery.textScalerOf(context);
    return VmCard(
      padding: const EdgeInsets.all(12),
      child: Row(
        children: [
          Padding(
            padding: const EdgeInsets.only(top: 6, right: 6),
            child: Skeleton(width: thumb, height: thumb),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: FractionallySizedBox(
              alignment: Alignment.centerLeft,
              widthFactor: 0.75,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Skeleton(height: text.scale(16)),
                  const SizedBox(height: 8),
                  FractionallySizedBox(
                    widthFactor: 0.66,
                    child: Skeleton(height: text.scale(12)),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
