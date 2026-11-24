import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';

import 'compact_nav_bar.dart';
import 'profile_avatar_button.dart';
import 'vinylmania_wordmark.dart';

const _destinations = [
  (
    path: '/',
    label: 'News',
    icon: Icons.newspaper_outlined,
    selectedIcon: Icons.newspaper,
  ),
  (
    path: '/search',
    label: 'Search',
    icon: Icons.search,
    selectedIcon: Icons.search,
  ),
  (
    path: '/library',
    label: 'Library',
    icon: Icons.album_outlined,
    selectedIcon: Icons.album,
  ),
  (
    path: '/wishlist',
    label: 'Wishlist',
    icon: Icons.favorite_outline,
    selectedIcon: Icons.favorite,
  ),
  (
    path: '/stats',
    label: 'Stats',
    icon: Icons.insights_outlined,
    selectedIcon: Icons.insights,
  ),
  (
    path: '/profile',
    label: 'Profile',
    icon: Icons.person_outline,
    selectedIcon: Icons.person,
  ),
];

/// Index of the destination owning [location]; details belong to the tab
/// they are opened from.
int _indexFor(String location) {
  final path = Uri.parse(location).path;
  if (path.startsWith('/search') ||
      path.startsWith('/releases') ||
      path.startsWith('/masters')) {
    return 1;
  }
  if (path.startsWith('/library')) return 2;
  if (path.startsWith('/wishlist')) return 3;
  if (path.startsWith('/stats')) return 4;
  if (path.startsWith('/profile')) return 5;
  return 0;
}

/// App chrome around every signed-in screen: bottom tabs + top bar when
/// compact, a navigation rail when expanded. ⌘/Ctrl+K opens Search.
class AppShell extends StatelessWidget {
  const AppShell({super.key, required this.location, required this.child});

  final String location;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final index = _indexFor(location);
    void goTo(int i) => context.go(_destinations[i].path);
    void search() => context.go('/search');

    final expanded = MediaQuery.sizeOf(context).width >= 840;
    final Widget scaffold = expanded
        ? Scaffold(
            body: SafeArea(
              child: Row(
                children: [
                  NavigationRail(
                    selectedIndex: index,
                    onDestinationSelected: goTo,
                    labelType: NavigationRailLabelType.all,
                    leading: const Padding(
                      padding: EdgeInsets.symmetric(vertical: 16),
                      child: VinylmaniaWordmark(fontSize: 20),
                    ),
                    destinations: [
                      for (final d in _destinations)
                        NavigationRailDestination(
                          icon: Icon(d.icon),
                          selectedIcon: Icon(d.selectedIcon),
                          label: Text(d.label),
                        ),
                    ],
                  ),
                  const VerticalDivider(width: 1),
                  Expanded(
                    child: Align(
                      alignment: Alignment.topCenter,
                      child: ConstrainedBox(
                        constraints: const BoxConstraints(maxWidth: 1280),
                        child: child,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          )
        : Scaffold(
            appBar: AppBar(
              title: const VinylmaniaWordmark(fontSize: 22),
              centerTitle: false,
              actions: const [ProfileAvatarButton(), SizedBox(width: 8)],
            ),
            body: child,
            bottomNavigationBar: CompactNavBar(
              destinations: [
                for (final d in _destinations.take(5))
                  (label: d.label, icon: d.icon, selectedIcon: d.selectedIcon),
              ],
              selectedIndex: index < 5 ? index : null,
              onSelected: goTo,
            ),
          );

    return CallbackShortcuts(
      bindings: {
        const SingleActivator(LogicalKeyboardKey.keyK, meta: true): search,
        const SingleActivator(LogicalKeyboardKey.keyK, control: true): search,
      },
      child: Focus(autofocus: true, child: scaffold),
    );
  }
}
