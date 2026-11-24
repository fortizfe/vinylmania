import 'package:material_ui/material_ui.dart';

import '../view_models/save_status.dart';
import 'error_line.dart';
import 'status_line.dart';

/// Per-field autosave feedback (web `InlineEditableField`).
class SaveStatusLine extends StatelessWidget {
  const SaveStatusLine({super.key, required this.status});

  final SaveStatus status;

  @override
  Widget build(BuildContext context) => switch (status) {
    SaveStatus.idle => const SizedBox.shrink(),
    SaveStatus.saving => const StatusLine('Saving…'),
    SaveStatus.saved => const StatusLine('Saved'),
    SaveStatus.failed => const ErrorLine(
      "Couldn't save — check your connection and try again.",
    ),
  };
}
