import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';

import 'vm_button.dart';
import 'vm_card.dart';

/// The Discogs gate (`discogs_not_linked` / `discogs_link_invalid`) with a
/// button to Profile.
///
/// [context]:
/// - `library`, `wishlist`, `stats`: whole-screen gate (web
///   `LibraryLinkRequired` / `WantlistLinkRequired`), title + body.
/// - `add-to-library`, `add-to-wishlist`: inline gate after an add action
///   (web `gateMessage()`).
class DiscogsLinkGate extends StatelessWidget {
  const DiscogsLinkGate({
    super.key,
    required this.relink,
    required this.context,
  });

  final bool relink;
  final String context;

  static const _pageTargets = {
    'library': (
      linked: 'Your library is synchronized with your Discogs collection.',
      keepUsing: 'your library',
    ),
    'wishlist': (
      linked: 'Your wishlist is synchronized with your Discogs wantlist.',
      keepUsing: 'your wishlist',
    ),
    'stats': (
      linked: 'Your collection stats are built from your Discogs collection.',
      keepUsing: 'your collection stats',
    ),
  };

  static const _actionTargets = {
    'add-to-library': 'your library',
    'add-to-wishlist': 'your wishlist',
  };

  @override
  Widget build(BuildContext context) {
    assert(
      _pageTargets.containsKey(this.context) ||
          _actionTargets.containsKey(this.context),
      'Unknown DiscogsLinkGate context "${this.context}"',
    );
    final theme = Theme.of(context);
    final page = _pageTargets[this.context];
    final String? title;
    final String body;
    if (page != null) {
      title = relink
          ? 'Your Discogs link is no longer valid'
          : 'Link your Discogs account';
      body = relink
          ? 'Discogs rejected the stored connection — it may have been revoked '
                'from your Discogs settings. Re-link your account from your '
                'profile to keep using ${page.keepUsing}.'
          : '${page.linked} Link your accounts from your profile to start '
                'using it.';
    } else {
      final target = _actionTargets[this.context];
      title = null;
      body = relink
          ? 'Your Discogs link is no longer valid. Please re-link your account '
                'to add records to $target.'
          : 'You need to link your Discogs account before adding records to '
                '$target.';
    }

    return VmCard(
      child: Semantics(
        liveRegion: page == null,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            if (title != null) ...[
              Semantics(
                header: true,
                child: Text(
                  title,
                  style: theme.textTheme.titleMedium?.copyWith(
                    color: theme.colorScheme.onSurface,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
              const SizedBox(height: 8),
            ],
            Text(
              body,
              style: TextStyle(color: theme.colorScheme.onSurfaceVariant),
            ),
            const SizedBox(height: 12),
            VmButton.primary(
              onPressed: () => context.go('/profile'),
              label: 'Go to your profile',
            ),
          ],
        ),
      ),
    );
  }
}
