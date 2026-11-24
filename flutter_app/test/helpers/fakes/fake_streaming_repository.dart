import 'package:vinylmania/data/repositories/streaming_repository.dart';
import 'package:vinylmania/domain/models/streaming/streaming_link.dart';

import '../fixtures/streaming_fixtures.dart';

/// Answered by [onLinks] (default: one Apple Music link).
class FakeStreamingRepository implements StreamingRepository {
  Future<List<StreamingLink>> Function(
    List<String> barcodes,
    String artist,
    String title,
    String locale,
  )
  onLinks = (_, _, _, _) async => [streamingLink];

  @override
  Future<List<StreamingLink>> links({
    required List<String> barcodes,
    required String artist,
    required String title,
    required String locale,
  }) => onLinks(barcodes, artist, title, locale);
}
