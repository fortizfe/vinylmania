import 'package:material_ui/material_ui.dart';

import '../../../domain/models/library/library_sort.dart';
import '../view_models/library_view_model.dart';

/// Expanded-layout sort picker (web `<select id="library-sort">`).
class LibrarySortMenu extends StatelessWidget {
  const LibrarySortMenu({super.key, required this.viewModel});

  final LibraryViewModel viewModel;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        ExcludeSemantics(
          child: Text(
            'Sort',
            style: theme.textTheme.labelLarge?.copyWith(
              color: theme.colorScheme.onSurface,
            ),
          ),
        ),
        const SizedBox(width: 8),
        Semantics(
          label: 'Sort',
          child: DecoratedBox(
            decoration: BoxDecoration(
              border: Border.all(color: theme.colorScheme.outline),
              borderRadius: const BorderRadius.all(Radius.circular(8)),
            ),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12),
              child: DropdownButtonHideUnderline(
                child: DropdownButton<LibrarySort>(
                  value: viewModel.sort,
                  borderRadius: const BorderRadius.all(Radius.circular(8)),
                  onChanged: (sort) {
                    if (sort != null && sort != viewModel.sort) {
                      viewModel.setSort(sort);
                    }
                  },
                  items: [
                    for (final sort in LibrarySort.values)
                      DropdownMenuItem(value: sort, child: Text(sort.label)),
                  ],
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}
