import 'package:material_ui/material_ui.dart';

import '../../core/widgets/vm_button.dart';
import '../view_models/stats_view_model.dart';
import 'most_valuable_records_card.dart';
import 'stats_heading.dart';
import 'valuation_breakdown_sheet.dart';
import 'valuation_card.dart';
import 'valuation_notice_card.dart';

/// "Estimated market value": the notice, or the running valuation with the
/// most valuable records and the per-disc breakdown.
class ValuationSection extends StatelessWidget {
  const ValuationSection({super.key, required this.viewModel});

  final StatsViewModel viewModel;

  @override
  Widget build(BuildContext context) {
    final vm = viewModel;
    final notice = vm.notice;
    final valuation = vm.valuation;
    final perDisc = vm.perDisc;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const StatsHeading('Estimated market value'),
        const SizedBox(height: 16),
        if (notice != null)
          ValuationNoticeCard(notice: notice, onRetry: vm.retryValuation)
        else ...[
          ValuationCard(viewModel: vm),
          if (valuation != null && valuation.topValuable.isNotEmpty) ...[
            const SizedBox(height: 16),
            MostValuableRecordsCard(
              records: valuation.topValuable,
              currency: valuation.currency,
            ),
          ],
          if (perDisc != null && perDisc.isNotEmpty) ...[
            const SizedBox(height: 16),
            Align(
              alignment: Alignment.centerLeft,
              child: VmButton.secondary(
                onPressed: () => ValuationBreakdownSheet.show(
                  context,
                  rows: perDisc,
                  currency: valuation?.currency,
                ),
                label: 'Ver todos',
              ),
            ),
          ],
        ],
      ],
    );
  }
}
