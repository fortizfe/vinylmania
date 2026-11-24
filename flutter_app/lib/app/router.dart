import 'package:flutter/foundation.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../data/repositories/auth_repository.dart';
import '../ui/auth/view_models/sign_in_view_model.dart';
import '../ui/auth/widgets/sign_in_screen.dart';
import '../ui/auth/widgets/splash_screen.dart';
import '../ui/core/widgets/app_shell.dart';
import '../ui/dashboard/view_models/dashboard_view_model.dart';
import '../ui/dashboard/widgets/dashboard_screen.dart';
import '../ui/library/view_models/library_view_model.dart';
import '../ui/library/widgets/library_screen.dart';
import '../ui/profile/view_models/profile_view_model.dart';
import '../ui/profile/widgets/profile_screen.dart';
import '../ui/release_detail/view_models/master_detail_view_model.dart';
import '../ui/release_detail/view_models/record_detail_view_model.dart';
import '../ui/release_detail/view_models/release_detail_view_model.dart';
import '../ui/release_detail/widgets/master_detail_screen.dart';
import '../ui/release_detail/widgets/record_detail_screen.dart';
import '../ui/release_detail/widgets/release_detail_screen.dart';
import '../ui/search/view_models/search_view_model.dart';
import '../ui/search/widgets/search_screen.dart';
import '../ui/stats/view_models/stats_view_model.dart';
import '../ui/stats/widgets/stats_screen.dart';
import '../ui/wishlist/view_models/wishlist_view_model.dart';
import '../ui/wishlist/widgets/wishlist_screen.dart';

/// Every route of the app (plan §4.4). One shell, one stack: tabs `go`,
/// details `push`. Auth state drives the redirect.
GoRouter buildRouter(AuthRepository authRepository) => GoRouter(
  initialLocation: '/splash',
  refreshListenable: authRepository,
  redirect: (context, state) {
    final at = state.matchedLocation;
    if (authRepository.isRestoring) return at == '/splash' ? null : '/splash';
    if (!authRepository.isSignedIn) return at == '/sign-in' ? null : '/sign-in';
    if (at == '/sign-in' || at == '/splash') return '/';
    return null;
  },
  routes: [
    GoRoute(path: '/splash', builder: (_, _) => const SplashScreen()),
    GoRoute(
      path: '/sign-in',
      builder: (c, _) => SignInScreen(
        createViewModel: () => SignInViewModel(c.read<AuthRepository>()),
      ),
    ),
    ShellRoute(
      builder: (_, s, child) =>
          AppShell(location: s.uri.toString(), child: child),
      routes: [
        GoRoute(
          path: '/',
          builder: (c, _) => DashboardScreen(
            createViewModel: () =>
                DashboardViewModel(feedsRepository: c.read()),
          ),
        ),
        GoRoute(
          path: '/search',
          builder: (c, s) {
            final q = s.uri.queryParameters['q'] ?? '';
            // A new q is a new search; the same q keeps the live results.
            return SearchScreen(
              key: ValueKey(q),
              createViewModel: () => SearchViewModel(
                catalogRepository: c.read(),
                libraryRepository: c.read(),
                wantlistRepository: c.read(),
                initialQuery: q,
              ),
            );
          },
        ),
        GoRoute(
          path: '/releases/:id',
          builder: (c, s) => ReleaseDetailScreen(
            createViewModel: () => ReleaseDetailViewModel(
              releaseId: _id(s),
              catalogRepository: c.read(),
              libraryRepository: c.read(),
              wantlistRepository: c.read(),
              streamingRepository: c.read(),
            ),
          ),
        ),
        GoRoute(
          path: '/masters/:id',
          builder: (c, s) => MasterDetailScreen(
            createViewModel: () => MasterDetailViewModel(
              masterId: _id(s),
              catalogRepository: c.read(),
              streamingRepository: c.read(),
            ),
          ),
        ),
        GoRoute(
          path: '/library',
          builder: (c, _) => LibraryScreen(
            createViewModel: () =>
                LibraryViewModel(libraryRepository: c.read()),
          ),
          routes: [
            GoRoute(
              path: 'records/:entryId',
              builder: (c, s) => RecordDetailScreen(
                createViewModel: () => RecordDetailViewModel(
                  entryId: s.pathParameters['entryId']!,
                  libraryRepository: c.read(),
                  streamingRepository: c.read(),
                ),
              ),
            ),
          ],
        ),
        GoRoute(
          path: '/wishlist',
          builder: (c, _) => WishlistScreen(
            createViewModel: () =>
                WishlistViewModel(wantlistRepository: c.read()),
          ),
        ),
        GoRoute(
          path: '/stats',
          builder: (c, _) => StatsScreen(
            createViewModel: () =>
                StatsViewModel(collectionStatsRepository: c.read()),
          ),
        ),
        GoRoute(
          path: '/profile',
          builder: (c, _) => ProfileScreen(
            createViewModel: () => ProfileViewModel(
              authRepository: c.read(),
              discogsConnectionRepository: c.read(),
            ),
          ),
        ),
      ],
    ),
  ],
);

/// Numeric `:id`, or 0 (the screen's not-found state) when it isn't one.
int _id(GoRouterState state) => int.tryParse(state.pathParameters['id']!) ?? 0;
