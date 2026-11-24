import 'package:material_ui/material_ui.dart';

import '../../../domain/catalog_filter_options.dart';
import '../../../domain/models/catalog/catalog_filters.dart';
import '../../../domain/models/library/library_sort.dart';
import '../../core/widgets/multi_select_filter_sheet.dart';
import '../../core/widgets/vm_button.dart';
import '../view_models/library_view_model.dart';

/// The library's "Sort & Filter" sheet (compact, with the sort radios) or
/// "Filters" dialog (expanded). Every change applies live, like the web's
/// `FiltersControl live`.
class LibraryFilterPanel extends StatelessWidget {
  const LibraryFilterPanel._({
    required this.viewModel,
    required this.includeSort,
  });

  final LibraryViewModel viewModel;
  final bool includeSort;

  static Future<void> show(
    BuildContext context, {
    required LibraryViewModel viewModel,
    required bool includeSort,
  }) {
    final panel = LibraryFilterPanel._(
      viewModel: viewModel,
      includeSort: includeSort,
    );
    if (MediaQuery.sizeOf(context).width < 840) {
      return showModalBottomSheet<void>(
        context: context,
        isScrollControlled: true,
        useSafeArea: true,
        showDragHandle: true,
        builder: (_) => panel,
      );
    }
    return showDialog<void>(
      context: context,
      builder: (_) => Dialog(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 480),
          child: panel,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final muted = theme.textTheme.labelMedium?.copyWith(
      color: theme.colorScheme.onSurfaceVariant,
    );
    return ListenableBuilder(
      listenable: viewModel,
      builder: (context, _) {
        final filters = viewModel.filters;
        Widget facet(
          String title,
          List<String> options,
          Set<String> selected,
          CatalogFilters Function(Set<String>) apply,
        ) => ListTile(
          title: Text(title),
          subtitle: Text(
            selected.isEmpty
                ? 'All'
                : options.where(selected.contains).join(', '),
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
          ),
          trailing: const Icon(Icons.chevron_right),
          onTap: () async {
            final next = await MultiSelectFilterSheet.show(
              context,
              title: title,
              options: options,
              selected: selected,
            );
            if (next != null) viewModel.setFilters(apply(next));
          },
        );

        return SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            mainAxisSize: MainAxisSize.min,
            children: [
              Semantics(
                header: true,
                child: Text(
                  includeSort ? 'Sort & Filter' : 'Filters',
                  style: theme.textTheme.titleLarge,
                ),
              ),
              if (includeSort) ...[
                const SizedBox(height: 12),
                Text('Sort by', style: theme.textTheme.titleSmall),
                RadioGroup<LibrarySort>(
                  groupValue: viewModel.sort,
                  onChanged: (sort) {
                    if (sort != null && sort != viewModel.sort) {
                      viewModel.setSort(sort);
                    }
                  },
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      for (final (i, sort) in LibrarySort.values.indexed) ...[
                        if (i == 0 ||
                            LibrarySort.values[i - 1].group != sort.group)
                          Padding(
                            padding: const EdgeInsets.only(top: 8),
                            child: Text(sort.group.toUpperCase(), style: muted),
                          ),
                        RadioListTile<LibrarySort>.adaptive(
                          value: sort,
                          title: Text(sort.label),
                          contentPadding: EdgeInsets.zero,
                        ),
                      ],
                    ],
                  ),
                ),
              ],
              const SizedBox(height: 12),
              // Format leads, as on the web (FiltersControl).
              facet(
                'Format',
                formatOptions,
                filters.format,
                (s) => CatalogFilters(
                  genre: filters.genre,
                  style: filters.style,
                  format: s,
                ),
              ),
              facet(
                'Genre',
                genreOptions,
                filters.genre,
                (s) => CatalogFilters(
                  genre: s,
                  style: filters.style,
                  format: filters.format,
                ),
              ),
              facet(
                'Style',
                styleOptions,
                filters.style,
                (s) => CatalogFilters(
                  genre: filters.genre,
                  style: s,
                  format: filters.format,
                ),
              ),
              const SizedBox(height: 12),
              Align(
                alignment: Alignment.centerLeft,
                child: VmButton.secondary(
                  onPressed: filters.isEmpty
                      ? null
                      : () => viewModel.setFilters(CatalogFilters.none),
                  label: 'Clear all filters',
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}
