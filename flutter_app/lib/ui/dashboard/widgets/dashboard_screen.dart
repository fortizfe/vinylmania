import 'package:material_ui/material_ui.dart';

import '../view_models/dashboard_view_model.dart';
import 'dashboard_compact_layout.dart';
import 'dashboard_expanded_layout.dart';

/// News (`/`, web `DashboardPage`). Creates its ViewModel on mount, loads
/// it, disposes it on unmount.
class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key, required this.createViewModel});

  /// Called once, when the screen mounts; the screen owns the result.
  final DashboardViewModel Function() createViewModel;

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  late final DashboardViewModel _viewModel = widget.createViewModel();

  @override
  void initState() {
    super.initState();
    _viewModel.load();
  }

  @override
  void dispose() {
    _viewModel.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final expanded = MediaQuery.sizeOf(context).width >= 840;
    return ListenableBuilder(
      listenable: _viewModel,
      builder: (context, _) => expanded
          ? DashboardExpandedLayout(viewModel: _viewModel)
          : DashboardCompactLayout(viewModel: _viewModel),
    );
  }
}
