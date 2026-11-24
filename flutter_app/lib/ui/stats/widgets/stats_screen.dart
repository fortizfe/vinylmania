import 'package:material_ui/material_ui.dart';

import '../view_models/stats_view_model.dart';
import 'stats_compact_layout.dart';
import 'stats_expanded_layout.dart';

/// Collection stats + valuation (web `CollectionStatsPage`).
class StatsScreen extends StatefulWidget {
  const StatsScreen({super.key, required this.createViewModel});

  /// Called once, when the screen mounts; the screen owns the result.
  final StatsViewModel Function() createViewModel;

  @override
  State<StatsScreen> createState() => _StatsScreenState();
}

class _StatsScreenState extends State<StatsScreen> {
  late final StatsViewModel _viewModel = widget.createViewModel()..load();

  @override
  void dispose() {
    _viewModel.dispose(); // cancels the valuation loop
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final expanded = MediaQuery.sizeOf(context).width >= 840;
    return ListenableBuilder(
      listenable: _viewModel,
      builder: (context, _) => expanded
          ? StatsExpandedLayout(viewModel: _viewModel)
          : StatsCompactLayout(viewModel: _viewModel),
    );
  }
}
