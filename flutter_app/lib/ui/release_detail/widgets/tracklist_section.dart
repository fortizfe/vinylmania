import 'package:material_ui/material_ui.dart';

import '../../../domain/models/catalog/track.dart';
import '../../core/widgets/vm_card.dart';
import 'section_heading.dart';

/// Web `ReleaseTracklistSection`, selectable so titles can be copied.
class TracklistSection extends StatelessWidget {
  const TracklistSection({super.key, required this.tracklist});

  final List<Track> tracklist;

  @override
  Widget build(BuildContext context) {
    final style = TextStyle(color: Theme.of(context).colorScheme.onSurface);
    return VmCard(
      child: SelectionArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          spacing: 4,
          children: [
            const SectionHeading('Tracklist'),
            const SizedBox(height: 4),
            for (final t in tracklist)
              Text(
                '${t.position}. ${t.title}'
                '${t.duration == null ? '' : ' (${t.duration})'}',
                style: style,
              ),
          ],
        ),
      ),
    );
  }
}
