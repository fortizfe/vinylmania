import '../../domain/models/streaming/streaming_link.dart';
import '../services/streaming_api.dart';

/// Streaming-platform links for a record. Throws `ApiException`.
class StreamingRepository {
  StreamingRepository({required this._api});

  final StreamingApi _api;

  /// [locale] is a BCP-47 tag (the device locale), e.g. `es-ES`.
  Future<List<StreamingLink>> links({
    required List<String> barcodes,
    required String artist,
    required String title,
    required String locale,
  }) => _api.links(
    barcodes: barcodes,
    artist: artist,
    title: title,
    locale: locale,
  );
}
