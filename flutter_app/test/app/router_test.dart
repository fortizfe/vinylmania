import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';
import 'package:provider/provider.dart';
import 'package:vinylmania/ui/core/theme/app_theme.dart';
import 'package:vinylmania/app/router.dart';
import 'package:vinylmania/data/repositories/auth_repository.dart';
import 'package:vinylmania/data/repositories/catalog_repository.dart';
import 'package:vinylmania/data/repositories/collection_stats_repository.dart';
import 'package:vinylmania/data/repositories/discogs_connection_repository.dart';
import 'package:vinylmania/data/repositories/feeds_repository.dart';
import 'package:vinylmania/data/repositories/library_repository.dart';
import 'package:vinylmania/data/repositories/streaming_repository.dart';
import 'package:vinylmania/data/repositories/wantlist_repository.dart';
import 'package:vinylmania/domain/models/paged.dart';
import 'package:vinylmania/ui/auth/widgets/sign_in_screen.dart';
import 'package:vinylmania/ui/auth/widgets/splash_screen.dart';
import 'package:vinylmania/ui/core/widgets/app_shell.dart';
import 'package:vinylmania/ui/dashboard/widgets/dashboard_screen.dart';
import 'package:vinylmania/ui/library/widgets/library_screen.dart';
import 'package:vinylmania/ui/profile/widgets/profile_screen.dart';
import 'package:vinylmania/ui/release_detail/widgets/master_detail_screen.dart';
import 'package:vinylmania/ui/release_detail/widgets/record_detail_screen.dart';
import 'package:vinylmania/ui/release_detail/widgets/release_detail_screen.dart';
import 'package:vinylmania/ui/search/widgets/search_screen.dart';
import 'package:vinylmania/ui/stats/widgets/stats_screen.dart';
import 'package:vinylmania/ui/wishlist/widgets/wishlist_screen.dart';

import '../helpers/fakes/fake_auth_repository.dart';
import '../helpers/fakes/fake_catalog_repository.dart';
import '../helpers/fakes/fake_collection_stats_repository.dart';
import '../helpers/fakes/fake_discogs_connection_repository.dart';
import '../helpers/fakes/fake_feeds_repository.dart';
import '../helpers/fakes/fake_library_repository.dart';
import '../helpers/fakes/fake_streaming_repository.dart';
import '../helpers/fakes/fake_wantlist_repository.dart';
import '../helpers/fixtures/catalog_fixtures.dart';
import '../helpers/fixtures/feeds_fixtures.dart';
import '../helpers/fixtures/library_fixtures.dart';

void main() {
  late FakeAuthRepository auth;
  late GoRouter router;
  late FakeCatalogRepository catalog;
  late FakeFeedsRepository feeds;
  late FakeLibraryRepository library;

  setUp(() {
    catalog = FakeCatalogRepository();
    feeds = FakeFeedsRepository();
    library = FakeLibraryRepository();
  });

  Future<void> pumpApp(WidgetTester tester, {String? at}) async {
    router = buildRouter(auth);
    addTearDown(router.dispose);
    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ChangeNotifierProvider<AuthRepository>.value(value: auth),
          Provider<CatalogRepository>.value(value: catalog),
          ChangeNotifierProvider<LibraryRepository>.value(value: library),
          ChangeNotifierProvider<WantlistRepository>.value(
            value: FakeWantlistRepository(),
          ),
          Provider<FeedsRepository>.value(value: feeds),
          Provider<StreamingRepository>.value(value: FakeStreamingRepository()),
          Provider<CollectionStatsRepository>.value(
            value: FakeCollectionStatsRepository(),
          ),
          Provider<DiscogsConnectionRepository>.value(
            value: FakeDiscogsConnectionRepository(),
          ),
        ],
        child: MaterialApp.router(
          routerConfig: router,
          theme: buildLightTheme(),
        ),
      ),
    );
    if (at != null) router.go(at);
    await tester.pump();
    await tester.pump();
  }

  String location() => router.routeInformationProvider.value.uri.toString();

  group('redirects', () {
    testWidgets('restoring → /splash', (tester) async {
      auth = FakeAuthRepository(isRestoring: true);
      await pumpApp(tester, at: '/library');

      expect(location(), '/splash');
      expect(find.byType(SplashScreen), findsOneWidget);
    });

    testWidgets('signed out → /sign-in from anywhere', (tester) async {
      auth = FakeAuthRepository();
      await pumpApp(tester, at: '/releases/1');

      expect(location(), '/sign-in');
      expect(find.byType(SignInScreen), findsOneWidget);
      expect(find.byType(AppShell), findsNothing);
    });

    testWidgets('signed in on /splash or /sign-in → /', (tester) async {
      auth = FakeAuthRepository(user: testUser);
      await pumpApp(tester, at: '/sign-in');
      expect(location(), '/');

      router.go('/splash');
      await tester.pump();
      expect(location(), '/');
      expect(find.byType(DashboardScreen), findsOneWidget);
    });

    testWidgets('auth changes re-run the redirect', (tester) async {
      auth = FakeAuthRepository(isRestoring: true);
      await pumpApp(tester);
      expect(location(), '/splash');

      auth
        ..isRestoring = false
        ..user = testUser
        ..notifyListeners();
      await tester.pump();
      await tester.pump();
      expect(location(), '/');

      auth.expireSession();
      await tester.pump();
      await tester.pump();
      expect(location(), '/sign-in');
    });
  });

  final screens = <String, Type>{
    '/': DashboardScreen,
    '/search': SearchScreen,
    '/search?q=abba': SearchScreen,
    '/releases/42': ReleaseDetailScreen,
    '/masters/7': MasterDetailScreen,
    '/library': LibraryScreen,
    '/library/records/entry-1': RecordDetailScreen,
    '/wishlist': WishlistScreen,
    '/stats': StatsScreen,
    '/profile': ProfileScreen,
  };
  for (final MapEntry(key: path, value: screen) in screens.entries) {
    testWidgets('$path builds $screen inside the shell', (tester) async {
      auth = FakeAuthRepository(user: testUser);
      await pumpApp(tester, at: path);

      expect(find.byType(screen), findsOneWidget);
      expect(find.byType(AppShell), findsOneWidget);
    });
  }

  Future<void> go(WidgetTester tester, String location) async {
    router.go(location);
    await tester.pump();
    await tester.pump();
  }

  testWidgets('route params reach the view models', (tester) async {
    auth = FakeAuthRepository(user: testUser);
    final releaseIds = <int>[];
    final masterIds = <int>[];
    final queries = <String>[];
    final entryIds = <String>[];
    library.onGet = (id) async {
      entryIds.add(id);
      return libraryEntry;
    };
    catalog
      ..onGetRelease = (id) async {
        releaseIds.add(id);
        return release;
      }
      ..onGetMaster = (id) async {
        masterIds.add(id);
        return master;
      }
      ..onSearch = (q, page, _) async {
        queries.add(q);
        return Paged(items: const [], page: page, hasMore: false);
      };

    await pumpApp(tester, at: '/search?q=abba');
    await go(tester, '/releases/42');
    await go(tester, '/releases/abc');
    await go(tester, '/masters/x1');
    await go(tester, '/library/records/entry-1');

    expect(queries, ['abba']);
    expect(releaseIds, [42], reason: 'a non-numeric id is the not-found 0');
    expect(masterIds, isEmpty);
    expect(entryIds, ['entry-1']);
    expect(tester.takeException(), isNull);
  });

  // go_router re-runs route builders on every auth refresh; the screen's
  // State, and so its ViewModel, must survive it.
  for (final MapEntry(key: path, value: screen) in {
    ...screens,
    '/sign-in': SignInScreen,
  }.entries) {
    testWidgets('$path keeps its ViewModel across a route rebuild', (
      tester,
    ) async {
      auth = FakeAuthRepository(user: path == '/sign-in' ? null : testUser);
      await pumpApp(tester, at: path);
      final before = tester.state(find.byType(screen));

      auth.notifyListeners();
      await tester.pump();
      await tester.pump();

      expect(identical(tester.state(find.byType(screen)), before), isTrue);
    });
  }

  testWidgets('a route rebuild does not reload the dashboard', (tester) async {
    auth = FakeAuthRepository(user: testUser);
    var loads = 0;
    feeds.onDashboard = () async {
      loads++;
      return feedsDashboard;
    };
    await pumpApp(tester, at: '/');

    auth.notifyListeners();
    await tester.pump();

    expect(loads, 1);
  });

  testWidgets('a new search q starts a new search; the same q keeps it', (
    tester,
  ) async {
    auth = FakeAuthRepository(user: testUser);
    final queries = <String>[];
    catalog.onSearch = (q, page, _) async {
      queries.add(q);
      return Paged(items: const [], page: page, hasMore: false);
    };
    await pumpApp(tester, at: '/search?q=metallica');

    auth.notifyListeners();
    await tester.pump();
    await go(tester, '/search?q=metallica');
    expect(queries, ['metallica']);

    await go(tester, '/search?q=slayer');
    expect(queries, ['metallica', 'slayer']);
    expect(find.text('slayer'), findsOneWidget);
  });
}
