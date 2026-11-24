import 'package:material_ui/material_ui.dart';

import '../../core/widgets/vm_text_field.dart';
import '../view_models/save_status.dart';
import 'save_status_line.dart';

/// "Notes" of "Your copy": saved on submit or when focus leaves.
class CopyNotesField extends StatefulWidget {
  const CopyNotesField({
    super.key,
    required this.value,
    required this.enabled,
    required this.unavailable,
    required this.status,
    required this.onSave,
  });

  final String value;
  final bool enabled;
  final bool unavailable;
  final SaveStatus status;
  final ValueChanged<String> onSave;

  @override
  State<CopyNotesField> createState() => _CopyNotesFieldState();
}

class _CopyNotesFieldState extends State<CopyNotesField> {
  late final _controller = TextEditingController(text: widget.value);
  final _focus = FocusNode();
  late String _sent = widget.value;

  /// Submit also blurs: send each text once, unless the last send failed.
  void _save() {
    final text = _controller.text;
    if (text == _sent && widget.status != SaveStatus.failed) return;
    _sent = text;
    widget.onSave(text);
  }

  @override
  void initState() {
    super.initState();
    _focus.addListener(() {
      if (!_focus.hasFocus) _save();
    });
  }

  @override
  void didUpdateWidget(CopyNotesField old) {
    super.didUpdateWidget(old);
    if (widget.value != old.value && !_focus.hasFocus) {
      _controller.text = _sent = widget.value;
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    _focus.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    spacing: 4,
    children: [
      if (widget.unavailable)
        Text(
          'The “Notes” field is not available on this collection.',
          style: TextStyle(
            color: Theme.of(context).colorScheme.onSurfaceVariant,
          ),
        ),
      VmTextField(
        label: 'Notes',
        hintText: 'Add notes',
        controller: _controller,
        focusNode: _focus,
        enabled: widget.enabled,
        maxLines: null,
        textInputAction: TextInputAction.done,
        onSubmitted: (_) => _save(),
      ),
      SaveStatusLine(status: widget.status),
    ],
  );
}
