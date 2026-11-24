import 'package:material_ui/material_ui.dart';

import '../../core/widgets/view_mode_toggle.dart';
import '../../core/widgets/vm_button.dart';
import '../view_models/library_view_model.dart';
import 'library_filter_panel.dart';
import 'library_sort_menu.dart';
import '../../core/widgets/view_mode.dart';

/// Web `LibraryToolbar`. Compact: view toggle + "Sort & Filter" (one sheet
/// with sort and filters). Expanded: view toggle, a Sort menu and Filters.
class LibraryToolbar extends StatelessWidget {
  const LibraryToolbar({
    super.key,
    required this.viewModel,
    required this.mode,
    required this.onModeChanged,
  });

  final LibraryViewModel viewModel;
  final ViewMode mode;
  final ValueChanged<ViewMode> onModeChanged;

  @override
  Widget build(BuildContext context) {
    final compact = MediaQuery.sizeOf(context).width < 840;
    final count = viewModel.activeFilterCount;
    String withCount(String label) => count == 0 ? label : '$label ($count)';

    return Wrap(
      spacing: 12,
      runSpacing: 12,
      crossAxisAlignment: WrapCrossAlignment.center,
      children: [
        ViewModeToggle(mode: mode, onChanged: onModeChanged),
        if (compact)
          VmButton.secondary(
            onPressed: () => LibraryFilterPanel.show(
              context,
              viewModel: viewModel,
              includeSort: true,
            ),
            label: withCount('Sort & Filter'),
          )
        else ...[
          LibrarySortMenu(viewModel: viewModel),
          VmButton.secondary(
            onPressed: () => LibraryFilterPanel.show(
              context,
              viewModel: viewModel,
              includeSort: false,
            ),
            label: withCount('Filters'),
          ),
        ],
      ],
    );
  }
}
