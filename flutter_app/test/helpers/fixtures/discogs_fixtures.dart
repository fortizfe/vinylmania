import 'package:vinylmania/domain/models/discogs/discogs_connection_status.dart';

/// Wire shapes of `/api/discogs/oauth/*` (discogsOauthApi.ts).

const connectedStatusJson = <String, Object?>{
  'connected': true,
  'discogsUsername': 'vinyl_fan',
  'linkedAt': '2024-03-10T18:00:00.000Z',
};

const disconnectedStatusJson = <String, Object?>{'connected': false};

final connectedStatus = DiscogsConnectionStatus.fromJson(connectedStatusJson);
final disconnectedStatus = DiscogsConnectionStatus.fromJson(
  disconnectedStatusJson,
);
