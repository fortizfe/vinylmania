import 'package:material_ui/material_ui.dart';

import '../../../domain/models/feeds/source_status.dart';
import 'source_chip.dart';

/// "All sources" + one chip per source, in the order given. One row that
/// scrolls sideways when [scrollable] (compact), wrapping rows otherwise.
class SourceFilterBar extends StatelessWidget {
  const SourceFilterBar({
    super.key,
    required this.sources,
    required this.selectedSourceId,
    required this.onSelected,
    required this.scrollable,
  });

  final List<SourceStatus> sources;
  final String? selectedSourceId;
  final ValueChanged<String?> onSelected;
  final bool scrollable;

  @override
  Widget build(BuildContext context) {
    final chips = [
      SourceChip(
        label: 'All sources',
        selected: selectedSourceId == null,
        onTap: () => onSelected(null),
      ),
      for (final s in sources)
        SourceChip(
          label: s.sourceName,
          unavailable: !s.isAvailable,
          selected: selectedSourceId == s.sourceId,
          onTap: () => onSelected(s.sourceId),
        ),
    ];
    return Semantics(
      container: true,
      label: 'Filter by source',
      explicitChildNodes: true,
      child: scrollable
          ? SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(spacing: 8, children: chips),
            )
          : Wrap(spacing: 8, runSpacing: 8, children: chips),
    );
  }
}
