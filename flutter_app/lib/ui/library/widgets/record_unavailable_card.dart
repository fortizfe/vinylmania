import 'package:material_ui/material_ui.dart';

import '../../core/widgets/vm_card.dart';

/// A record whose catalog data couldn't load (`catalogStatus: unavailable`):
/// the web's italic notice plus a link to open it anyway. [footer] carries
/// extra actions (the wishlist's remove button).
class RecordUnavailableCard extends StatelessWidget {
  const RecordUnavailableCard({
    super.key,
    required this.actionLabel,
    required this.onOpen,
    this.footer,
  });

  final String actionLabel;
  final VoidCallback onOpen;
  final Widget? footer;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return VmCard(
      padding: const EdgeInsets.all(12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            "Couldn't load catalog details for this record right now.",
            style: TextStyle(
              color: scheme.onSurfaceVariant,
              fontStyle: FontStyle.italic,
            ),
          ),
          TextButton(onPressed: onOpen, child: Text(actionLabel)),
          ?footer,
        ],
      ),
    );
  }
}
