import 'package:material_ui/material_ui.dart';

import '../view_models/dashboard_view_model.dart';
import 'dashboard_body.dart';

/// Tablets and desktop: lead beside the tiles, two-column "Latest", wrapping
/// chips.
class DashboardExpandedLayout extends StatelessWidget {
  const DashboardExpandedLayout({super.key, required this.viewModel});

  final DashboardViewModel viewModel;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(32),
      child: DashboardBody(
        viewModel: viewModel,
        wide: true,
        scrollableChips: false,
      ),
    );
  }
}
