import 'package:material_ui/material_ui.dart';

import '../view_models/dashboard_view_model.dart';
import 'dashboard_body.dart';

/// Phones and narrow windows: one column, chips in one sideways row.
class DashboardCompactLayout extends StatelessWidget {
  const DashboardCompactLayout({super.key, required this.viewModel});

  final DashboardViewModel viewModel;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: DashboardBody(
        viewModel: viewModel,
        wide: false,
        scrollableChips: true,
      ),
    );
  }
}
