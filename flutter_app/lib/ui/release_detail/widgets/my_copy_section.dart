import 'package:material_ui/material_ui.dart';

import '../../../domain/copy_conditions.dart';
import '../../core/widgets/vm_card.dart';
import '../view_models/copy_field.dart';
import '../view_models/record_detail_view_model.dart';
import 'copy_condition_field.dart';
import 'copy_notes_field.dart';
import 'section_heading.dart';

/// Web `MyCopySection` ("Your copy"): media/sleeve condition and notes,
/// each autosaved on its own. The personal rating lives in the rating card.
class MyCopySection extends StatelessWidget {
  const MyCopySection({super.key, required this.viewModel});

  final RecordDetailViewModel viewModel;

  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: viewModel,
    builder: (context, _) => _build(),
  );

  Widget _build() {
    final vm = viewModel;
    final copy = vm.copy;
    return VmCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        spacing: 16,
        children: [
          const SectionHeading('Your copy'),
          CopyConditionField(
            label: 'Media Condition',
            value: copy?.mediaCondition,
            options: mediaConditions,
            enabled: copy?.mediaConditionEditable ?? false,
            unavailable: copy != null && !copy.mediaConditionEditable,
            status: vm.statusOf(CopyField.mediaCondition),
            onChanged: vm.saveMediaCondition,
          ),
          CopyConditionField(
            label: 'Sleeve Condition',
            value: copy?.sleeveCondition,
            options: sleeveConditions,
            enabled: copy?.sleeveConditionEditable ?? false,
            unavailable: copy != null && !copy.sleeveConditionEditable,
            status: vm.statusOf(CopyField.sleeveCondition),
            onChanged: vm.saveSleeveCondition,
          ),
          CopyNotesField(
            value: copy?.notes ?? '',
            enabled: copy?.notesEditable ?? false,
            unavailable: copy != null && !copy.notesEditable,
            status: vm.statusOf(CopyField.notes),
            onSave: vm.saveNotes,
          ),
        ],
      ),
    );
  }
}
