import 'package:material_ui/material_ui.dart';

import '../../core/widgets/page_title.dart';

/// Page title, plus the intro line unless the Discogs gate is showing.
class StatsHeader extends StatelessWidget {
  const StatsHeader({super.key, required this.showIntro});

  final bool showIntro;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const PageTitle('Mi colección en cifras'),
        if (showIntro) ...[
          const SizedBox(height: 4),
          Text(
            'Your collection by the numbers, built from your synced Discogs '
            'collection.',
            style: TextStyle(
              color: Theme.of(context).colorScheme.onSurfaceVariant,
            ),
          ),
        ],
      ],
    );
  }
}
