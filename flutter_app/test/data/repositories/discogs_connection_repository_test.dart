import 'dart:convert';

import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:vinylmania/data/repositories/discogs_connection_repository.dart';
import 'package:vinylmania/data/services/discogs_oauth_api.dart';

import '../../helpers/fakes/fake_oauth_browser.dart';
import '../../helpers/fixtures/discogs_fixtures.dart';
import '../../helpers/mock_api.dart';

import 'package:vinylmania/domain/models/discogs/discogs_link_outcome.dart';

const _authorizeUrl = 'https://discogs.com/oauth/authorize?oauth_token=abc';

void main() {
  late List<http.Request> requests;
  late FakeOAuthBrowser browser;

  /// `/request` answers with the authorize URL; `/complete` with
  /// [completeStatus] / [completeBody].
  DiscogsConnectionRepository repository({
    int requestStatus = 200,
    int completeStatus = 200,
    Object completeBody = connectedStatusJson,
    Uri? callback,
  }) {
    requests = [];
    browser = FakeOAuthBrowser(result: callback);
    return DiscogsConnectionRepository(
      api: DiscogsOauthApi(
        apiClientWith((r) async {
          requests.add(r);
          if (r.url.path.endsWith('/request')) {
            return http.Response(
              jsonEncode(
                requestStatus == 200
                    ? {'authorizeUrl': _authorizeUrl}
                    : {'error': 'internal_error', 'message': 'x'},
              ),
              requestStatus,
            );
          }
          return http.Response(jsonEncode(completeBody), completeStatus);
        }),
      ),
      oauthBrowser: browser,
    );
  }

  final approved = Uri.parse(
    'vinylmania://discogs/callback?oauth_token=tok&oauth_verifier=ver',
  );

  test(
    'link opens the authorize URL and completes with token + verifier',
    () async {
      final repo = repository(callback: approved);

      expect(await repo.link(), DiscogsLinkOutcome.linked);
      expect(browser.requested.single, Uri.parse(_authorizeUrl));
      expect(jsonDecode(requests.first.body), {'client': 'native'});
      expect(requests.last.url.path, '/api/discogs/oauth/complete');
      expect(jsonDecode(requests.last.body), {
        'oauthToken': 'tok',
        'oauthVerifier': 'ver',
      });
    },
  );

  test('link is denied when the user closes the browser', () async {
    final repo = repository(callback: null);

    expect(await repo.link(), DiscogsLinkOutcome.denied);
    expect(requests, hasLength(1)); // no /complete
  });

  test('link is denied when Discogs returns the denied param', () async {
    final repo = repository(
      callback: Uri.parse('vinylmania://discogs/callback?denied=tok'),
    );

    expect(await repo.link(), DiscogsLinkOutcome.denied);
    expect(requests, hasLength(1));
  });

  test('link is expired on expired_request from /complete', () async {
    final repo = repository(
      callback: approved,
      completeStatus: 400,
      completeBody: {'error': 'expired_request', 'message': 'Expired'},
    );

    expect(await repo.link(), DiscogsLinkOutcome.expired);
  });

  test('link is an error on any other /complete failure', () async {
    final repo = repository(
      callback: approved,
      completeStatus: 500,
      completeBody: {'error': 'internal_error', 'message': 'x'},
    );

    expect(await repo.link(), DiscogsLinkOutcome.error);
  });

  test('link is an error when /request fails', () async {
    final repo = repository(requestStatus: 500, callback: approved);

    expect(await repo.link(), DiscogsLinkOutcome.error);
    expect(browser.requested, isEmpty);
  });

  test('link is an error when the auth session itself fails', () async {
    final repo = repository(callback: approved);
    browser.error = PlatformException(code: 'UNKNOWN');

    expect(await repo.link(), DiscogsLinkOutcome.error);
  });
}
