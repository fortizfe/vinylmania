import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';

import '../../core/widgets/vm_button.dart';
import '../../core/widgets/vm_card.dart';

/// Web `DiscogsRelinkNotice` default copy: the search itself failed with
/// `discogs_link_invalid`.
// ponytail: local because DiscogsLinkGate has no "search" context; move it
// there if a second screen needs this exact copy.
class SearchRelinkNotice extends StatelessWidget {
  const SearchRelinkNotice({super.key});

  @override
  Widget build(BuildContext context) {
    return VmCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Semantics(
            liveRegion: true,
            child: Text(
              'Your Discogs link is no longer valid. Please re-link your '
              'account from your profile.',
              style: TextStyle(
                color: Theme.of(context).colorScheme.onSurfaceVariant,
              ),
            ),
          ),
          const SizedBox(height: 12),
          VmButton.primary(
            onPressed: () => context.go('/profile'),
            label: 'Go to your profile',
          ),
        ],
      ),
    );
  }
}
