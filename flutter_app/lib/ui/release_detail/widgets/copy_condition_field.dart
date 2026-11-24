import 'package:material_ui/material_ui.dart';

import '../view_models/save_status.dart';
import 'save_status_line.dart';

/// One grading picker of "Your copy". Choosing a value saves it at once.
/// "—" is only the empty hint: the backend has no "clear" for conditions.
class CopyConditionField extends StatelessWidget {
  const CopyConditionField({
    super.key,
    required this.label,
    required this.value,
    required this.options,
    required this.enabled,
    required this.unavailable,
    required this.status,
    required this.onChanged,
  });

  final String label;
  final String? value;
  final List<String> options;
  final bool enabled;

  /// The Discogs custom field was deleted: say why it's read-only.
  final bool unavailable;
  final SaveStatus status;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    // A value outside the vocabulary would crash the dropdown: show it as
    // the hint instead.
    final known = options.contains(value) ? value : null;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      spacing: 4,
      children: [
        if (unavailable)
          Text(
            'The “$label” field is not available on this collection.',
            style: TextStyle(color: scheme.onSurfaceVariant),
          ),
        DropdownButtonFormField<String>(
          key: ValueKey(known),
          initialValue: known,
          isExpanded: true,
          hint: Text(value ?? '—'),
          decoration: InputDecoration(
            labelText: label,
            border: const OutlineInputBorder(
              borderRadius: BorderRadius.all(Radius.circular(12)),
            ),
          ),
          items: [
            for (final o in options) DropdownMenuItem(value: o, child: Text(o)),
          ],
          onChanged: enabled && status != SaveStatus.saving
              ? (v) {
                  if (v != null && v != value) onChanged(v);
                }
              : null,
        ),
        SaveStatusLine(status: status),
      ],
    );
  }
}
