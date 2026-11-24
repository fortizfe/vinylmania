import 'package:material_ui/material_ui.dart';

import '../../../domain/models/catalog/release.dart';
import '../../core/widgets/vm_card.dart';
import 'section_heading.dart';

/// Web `ReleaseAdditionalInfoSection` ("Más información"): catalog notes and
/// pressing identifiers. Absent when there is neither.
class AdditionalInfoSection extends StatelessWidget {
  const AdditionalInfoSection({super.key, required this.release});

  final Release release;

  static bool hasContent(Release r) =>
      (r.notes?.isNotEmpty ?? false) || r.identifiers.isNotEmpty;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return VmCard(
      child: SelectionArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          spacing: 8,
          children: [
            const SectionHeading('Más información'),
            if (release.notes case final notes? when notes.isNotEmpty)
              Text(notes, style: TextStyle(color: scheme.onSurface)),
            for (final id in release.identifiers)
              Text(
                '${id.type}: ${id.value}'
                '${id.description == null ? '' : ' (${id.description})'}',
                style: TextStyle(color: scheme.onSurfaceVariant),
              ),
          ],
        ),
      ),
    );
  }
}
