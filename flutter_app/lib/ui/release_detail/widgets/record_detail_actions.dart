import 'package:material_ui/material_ui.dart';

import '../../core/widgets/vm_button.dart';
import 'error_line.dart';

/// Web `RecordDetailActions` (library view): Remove from library.
class RecordDetailActions extends StatelessWidget {
  const RecordDetailActions({
    super.key,
    required this.onRemove,
    required this.removing,
    this.removeError,
  });

  final VoidCallback onRemove;
  final bool removing;
  final String? removeError;

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    spacing: 8,
    children: [
      VmButton.secondary(
        onPressed: onRemove,
        loading: removing,
        label: 'Remove from library',
      ),
      if (removeError case final error?) ErrorLine(error),
    ],
  );
}
