import '../../domain/models/streaming/streaming_link.dart';
import 'api_client.dart';

/// `/api/streaming/links`.
class StreamingApi {
  StreamingApi(this._client);

  final ApiClient _client;

  Future<List<StreamingLink>> links({
    required List<String> barcodes,
    required String artist,
    required String title,
    required String locale,
  }) async {
    final body = await _client.get(
      '/api/streaming/links',
      query: {
        'artist': artist,
        'title': title,
        'locale': locale,
        if (barcodes.isNotEmpty) 'barcode': barcodes,
      },
    ) as Map<String, Object?>;
    return [
      for (final l in body['links'] as List)
        StreamingLink.fromJson(l as Map<String, Object?>),
    ];
  }
}
