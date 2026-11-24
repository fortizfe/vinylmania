import 'package:material_ui/material_ui.dart';

import '../../../domain/models/catalog/master_release.dart';
import '../../core/open_external_link.dart';
import '../../core/widgets/pressable.dart';
import '../../core/widgets/vm_badge.dart';
import '../../core/widgets/vm_card.dart';
import '../../core/widgets/badge_tone.dart';

/// Web `MasterReleaseOtherDetailsSection`: year, genres, styles and a
/// "View on Discogs" link. Absent when there is no year/genre/style.
class MasterOtherDetailsSection extends StatelessWidget {
  const MasterOtherDetailsSection({super.key, required this.master});

  final MasterRelease master;

  static bool hasContent(MasterRelease m) =>
      m.year != null || m.genres.isNotEmpty || m.styles.isNotEmpty;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return VmCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        spacing: 8,
        children: [
          Wrap(
            spacing: 8,
            runSpacing: 8,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              if (master.year case final year?)
                Text('$year', style: TextStyle(color: scheme.onSurfaceVariant)),
              for (final g in master.genres) VmBadge(label: g),
              for (final s in master.styles)
                VmBadge(label: s, tone: BadgeTone.muted),
            ],
          ),
          Semantics(
            link: true,
            child: Pressable(
              onTap: () => openExternalLink(Uri.parse(master.discogsUrl)),
              child: ConstrainedBox(
                constraints: const BoxConstraints(
                  minHeight: kMinInteractiveDimension,
                ),
                child: Align(
                  widthFactor: 1,
                  alignment: AlignmentDirectional.centerStart,
                  child: Text(
                    'View on Discogs',
                    style: TextStyle(
                      color: scheme.primary,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
