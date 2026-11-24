import '../../../domain/api_exception.dart';
import 'detail_status.dart';

/// Maps a failed detail fetch to its screen state (web: a revoked Discogs
/// link is told apart from a genuine 404).
DetailStatus detailStatusFor(ApiException e) => e.code == 'discogs_link_invalid'
    ? DetailStatus.relink
    : e.statusCode == 404
    ? DetailStatus.notFound
    : DetailStatus.error;
