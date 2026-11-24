import 'package:material_ui/material_ui.dart';

import '../../../domain/catalog_filter_options.dart';
import '../../../domain/models/catalog/catalog_filters.dart';
import '../../core/widgets/multi_select_filter_sheet.dart';
import '../../core/widgets/view_mode_toggle.dart';
import '../../core/widgets/vm_button.dart';
import '../../core/widgets/view_mode.dart';

/// Format / Genre / Style facets (web `FiltersControl` order), each showing
/// its selected count, "Clear filters" when any is active, and the
/// grid/list toggle.
class SearchToolbar extends StatelessWidget {
  const SearchToolbar({
    super.key,
    required this.filters,
    required this.onFiltersChanged,
    required this.onClear,
    required this.viewMode,
    required this.onViewModeChanged,
  });

  final CatalogFilters filters;
  final ValueChanged<CatalogFilters> onFiltersChanged;
  final VoidCallback onClear;
  final ViewMode viewMode;
  final ValueChanged<ViewMode> onViewModeChanged;

  @override
  Widget build(BuildContext context) {
    Widget facet(
      String title,
      List<String> options,
      Set<String> selected,
      CatalogFilters Function(Set<String>) apply,
    ) => VmButton.secondary(
      label: selected.isEmpty ? title : '$title (${selected.length})',
      onPressed: () async {
        final next = await MultiSelectFilterSheet.show(
          context,
          title: title,
          options: options,
          selected: selected,
        );
        if (next != null) onFiltersChanged(apply(next));
      },
    );

    final f = filters;
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      crossAxisAlignment: WrapCrossAlignment.center,
      children: [
        facet(
          'Format',
          formatOptions,
          f.format,
          (s) => CatalogFilters(genre: f.genre, style: f.style, format: s),
        ),
        facet(
          'Genre',
          genreOptions,
          f.genre,
          (s) => CatalogFilters(genre: s, style: f.style, format: f.format),
        ),
        facet(
          'Style',
          styleOptions,
          f.style,
          (s) => CatalogFilters(genre: f.genre, style: s, format: f.format),
        ),
        if (!f.isEmpty)
          VmButton.secondary(
            onPressed: onClear,
            label: 'Clear filters',
            icon: Icons.close,
          ),
        ViewModeToggle(mode: viewMode, onChanged: onViewModeChanged),
      ],
    );
  }
}
