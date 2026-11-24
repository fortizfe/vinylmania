import 'package:material_ui/material_ui.dart';

import '../../../domain/models/catalog/master_release.dart';
import '../../core/widgets/page_title.dart';
import '../../core/widgets/vm_card.dart';

/// Web `MasterReleaseDetailsSection`: the master's title and artists.
class MasterDetailsSection extends StatelessWidget {
  const MasterDetailsSection({super.key, required this.master});

  final MasterRelease master;

  @override
  Widget build(BuildContext context) => VmCard(
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        PageTitle(master.title),
        for (final a in master.artists)
          Text(
            a.name,
            style: TextStyle(
              color: Theme.of(context).colorScheme.onSurfaceVariant,
            ),
          ),
      ],
    ),
  );
}
