import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';

import '../../core/widgets/vm_button.dart';
import '../../core/widgets/vm_card.dart';

/// Web `DiscogsRelinkNotice`: a catalog read failed with
/// `discogs_link_invalid`.
class RelinkNotice extends StatelessWidget {
  const RelinkNotice({super.key});

  @override
  Widget build(BuildContext context) => SizedBox(
    width: double.infinity,
    child: VmCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Your Discogs link is no longer valid. Please re-link your '
            'account from your profile.',
            style: TextStyle(color: Theme.of(context).colorScheme.onSurface),
          ),
          const SizedBox(height: 12),
          VmButton.secondary(
            onPressed: () => context.go('/profile'),
            label: 'Go to your profile',
          ),
        ],
      ),
    ),
  );
}
