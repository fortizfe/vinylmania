import 'package:material_ui/material_ui.dart';

import '../../../domain/models/catalog/release.dart';
import '../../core/widgets/page_title.dart';
import '../../core/widgets/vm_badge.dart';
import '../../core/widgets/vm_card.dart';
import '../../core/widgets/badge_tone.dart';

/// Web `ReleaseDetailsSection`: the record title (the page header), artists
/// and the country / date / format / label / genre / style row.
class ReleaseDetailsSection extends StatelessWidget {
  const ReleaseDetailsSection({super.key, required this.release});

  final Release release;

  @override
  Widget build(BuildContext context) {
    final muted = TextStyle(
      color: Theme.of(context).colorScheme.onSurfaceVariant,
    );
    final meta = <Widget>[
      if (release.country case final country?) Text(country, style: muted),
      if (release.releaseDate case final date?) Text(date, style: muted),
      for (final f in release.formats)
        VmBadge(
          label: f.descriptions.isEmpty
              ? f.name
              : '${f.name} (${f.descriptions.join(', ')})',
          tone: BadgeTone.muted,
        ),
      for (final l in release.labels)
        VmBadge(
          label: l.catalogNumber == null
              ? l.name
              : '${l.name} (${l.catalogNumber})',
          tone: BadgeTone.muted,
        ),
      for (final g in release.genres) VmBadge(label: g),
      for (final s in release.styles) VmBadge(label: s, tone: BadgeTone.muted),
    ];
    return VmCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        spacing: 12,
        children: [
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              PageTitle(release.title),
              for (final a in release.artists) Text(a.name, style: muted),
            ],
          ),
          if (meta.isNotEmpty)
            Wrap(
              spacing: 8,
              runSpacing: 8,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: meta,
            ),
        ],
      ),
    );
  }
}
