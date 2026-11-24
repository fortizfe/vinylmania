import 'package:material_ui/material_ui.dart';

import 'vm_button.dart';
import 'vm_text_field.dart';

/// Searchable multi-select with Clear / Apply (web `SelectableListFilter` +
/// `FilterActions`). Bottom sheet when compact, dialog when expanded.
class MultiSelectFilterSheet extends StatefulWidget {
  const MultiSelectFilterSheet._({
    required this.title,
    required this.options,
    required this.selected,
  });

  final String title;
  final List<String> options;
  final Set<String> selected;

  /// The applied selection; `{}` after Clear; null when dismissed.
  static Future<Set<String>?> show(
    BuildContext context, {
    required String title,
    required List<String> options,
    required Set<String> selected,
  }) {
    final sheet = MultiSelectFilterSheet._(
      title: title,
      options: options,
      selected: selected,
    );
    if (MediaQuery.sizeOf(context).width < 840) {
      return showModalBottomSheet<Set<String>>(
        context: context,
        isScrollControlled: true,
        useSafeArea: true,
        showDragHandle: true,
        builder: (_) => sheet,
      );
    }
    return showDialog<Set<String>>(
      context: context,
      builder: (_) => Dialog(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 480, maxHeight: 640),
          child: sheet,
        ),
      ),
    );
  }

  @override
  State<MultiSelectFilterSheet> createState() => _MultiSelectFilterSheetState();
}

class _MultiSelectFilterSheetState extends State<MultiSelectFilterSheet> {
  late final Set<String> _selected = {...widget.selected};
  String _query = '';

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final query = _query.trim().toLowerCase();
    final visible = widget.options
        .where((o) => o.toLowerCase().contains(query))
        .toList();
    return ConstrainedBox(
      constraints: BoxConstraints(
        maxHeight: MediaQuery.sizeOf(context).height * 0.85,
      ),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Semantics(
              header: true,
              child: Text(widget.title, style: theme.textTheme.titleLarge),
            ),
            const SizedBox(height: 12),
            VmTextField(
              label: 'Search ${widget.title.toLowerCase()}',
              prefixIcon: Icons.search,
              onChanged: (v) => setState(() => _query = v),
            ),
            const SizedBox(height: 8),
            Flexible(
              child: ListView(
                shrinkWrap: true,
                children: [
                  for (final option in visible)
                    CheckboxListTile.adaptive(
                      value: _selected.contains(option),
                      title: Text(option),
                      controlAffinity: ListTileControlAffinity.leading,
                      onChanged: (checked) => setState(
                        () => checked == true
                            ? _selected.add(option)
                            : _selected.remove(option),
                      ),
                    ),
                ],
              ),
            ),
            const SizedBox(height: 12),
            Wrap(
              alignment: WrapAlignment.end,
              spacing: 8,
              runSpacing: 8,
              children: [
                VmButton.secondary(
                  onPressed: () => Navigator.of(context).pop(<String>{}),
                  label: 'Clear',
                ),
                VmButton.primary(
                  onPressed: () => Navigator.of(context).pop(_selected),
                  label: 'Apply',
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
