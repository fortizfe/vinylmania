import 'package:http/http.dart' as http;
import 'package:provider/provider.dart';
import 'package:provider/single_child_widget.dart';

import '../data/repositories/auth_repository.dart';
import '../data/repositories/catalog_repository.dart';
import '../data/repositories/collection_stats_repository.dart';
import '../data/repositories/discogs_connection_repository.dart';
import '../data/repositories/feeds_repository.dart';
import '../data/repositories/library_repository.dart';
import '../data/repositories/streaming_repository.dart';
import '../data/repositories/wantlist_repository.dart';
import '../data/services/api_client.dart';
import '../data/services/auth_api.dart';
import '../data/services/collection_stats_api.dart';
import '../data/services/discogs_catalog_api.dart';
import '../data/services/discogs_oauth_api.dart';
import '../data/services/feeds_api.dart';
import '../data/services/library_api.dart';
import '../data/services/oauth_browser.dart';
import '../data/services/session_storage.dart';
import '../data/services/streaming_api.dart';
import '../data/services/wantlist_api.dart';

/// Every repository the screens read, wired over one [ApiClient]. Tests
/// swap the HTTP client, the storage and the browser.
List<SingleChildWidget> buildProviders({
  http.Client? httpClient,
  SessionStorage? sessionStorage,
  OAuthBrowser? oauthBrowser,
}) {
  final storage = sessionStorage ?? SessionStorage();
  final browser = oauthBrowser ?? const OAuthBrowser();
  final api = ApiClient(
    httpClient: httpClient ?? http.Client(),
    sessionStorage: storage,
  );
  return [
    ChangeNotifierProvider(
      create: (_) => AuthRepository(
        authApi: AuthApi(api),
        sessionStorage: storage,
        oauthBrowser: browser,
        apiClient: api,
      ),
    ),
    Provider(create: (_) => CatalogRepository(api: DiscogsCatalogApi(api))),
    ChangeNotifierProvider(
      create: (_) => LibraryRepository(api: LibraryApi(api)),
    ),
    ChangeNotifierProvider(
      create: (_) => WantlistRepository(api: WantlistApi(api)),
    ),
    Provider(create: (_) => FeedsRepository(api: FeedsApi(api))),
    Provider(create: (_) => StreamingRepository(api: StreamingApi(api))),
    Provider(
      create: (_) => CollectionStatsRepository(api: CollectionStatsApi(api)),
    ),
    Provider(
      create: (_) => DiscogsConnectionRepository(
        api: DiscogsOauthApi(api),
        oauthBrowser: browser,
      ),
    ),
  ];
}
