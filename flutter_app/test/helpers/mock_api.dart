import 'package:http/testing.dart';
import 'package:vinylmania/data/services/api_client.dart';

import 'fakes/fake_session_storage.dart';

const testBaseUrl = 'http://api.test';

/// An [ApiClient] whose requests go to [handler]; [token] seeds the session.
ApiClient apiClientWith(MockClientHandler handler, {String? token}) =>
    ApiClient(
      httpClient: MockClient(handler),
      sessionStorage: FakeSessionStorage(token),
      baseUrl: testBaseUrl,
    );
