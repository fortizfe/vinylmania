import 'package:vinylmania/data/repositories/discogs_connection_repository.dart';
import 'package:vinylmania/domain/models/discogs/discogs_connection_status.dart';

import '../fixtures/discogs_fixtures.dart';

import 'package:vinylmania/domain/models/discogs/discogs_link_outcome.dart';

/// Each call is answered by its `onX` handler (defaults: connected, linked).
class FakeDiscogsConnectionRepository implements DiscogsConnectionRepository {
  Future<DiscogsConnectionStatus> Function() onStatus = () async =>
      connectedStatus;
  Future<DiscogsLinkOutcome> Function() onLink = () async =>
      DiscogsLinkOutcome.linked;
  Future<void> Function() onDisconnect = () async {};

  @override
  Future<DiscogsConnectionStatus> status() => onStatus();

  @override
  Future<DiscogsLinkOutcome> link() => onLink();

  @override
  Future<void> disconnect() => onDisconnect();
}
