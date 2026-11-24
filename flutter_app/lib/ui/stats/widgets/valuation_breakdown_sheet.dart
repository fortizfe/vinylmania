import 'package:material_ui/material_ui.dart';

import '../../../domain/models/collection_stats/per_disc_value.dart';
import '../../core/widgets/vm_button.dart';
import 'per_disc_value_row.dart';
import 'stats_heading.dart';

/// The full per-disc breakdown behind "Ver todos": a bottom sheet when
/// compact, a dialog when expanded.
abstract final class ValuationBreakdownSheet {
  static Future<void> show(
    BuildContext context, {
    required List<PerDiscValue> rows,
    required String? currency,
  }) {
    Widget content(BuildContext context) => Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 8, 8),
          child: Row(
            children: [
              const Expanded(child: StatsHeading('Per-disc breakdown')),
              VmButton.icon(
                onPressed: () => Navigator.of(context).pop(),
                label: 'Close',
                icon: Icons.close,
              ),
            ],
          ),
        ),
        const Divider(height: 1),
        Flexible(
          child: ListView.separated(
            shrinkWrap: true,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            itemCount: rows.length,
            separatorBuilder: (_, _) => const Divider(height: 1),
            itemBuilder: (_, i) =>
                PerDiscValueRow(disc: rows[i], currency: currency),
          ),
        ),
      ],
    );

    if (MediaQuery.sizeOf(context).width >= 840) {
      return showDialog<void>(
        context: context,
        builder: (context) => Dialog(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 640, maxHeight: 640),
            child: content(context),
          ),
        ),
      );
    }
    return showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      showDragHandle: true,
      builder: (context) => ConstrainedBox(
        constraints: BoxConstraints(
          maxHeight: MediaQuery.sizeOf(context).height * 0.85,
        ),
        child: content(context),
      ),
    );
  }
}
