import 'package:flutter/foundation.dart';

import '../../../data/repositories/streaming_repository.dart';
import '../../../domain/api_exception.dart';
import '../../../domain/models/streaming/streaming_link.dart';

/// Streaming links of one record, fetched after the record itself with the
/// device locale (web `useStreamingLinks` + `navigator.language`). A failure
/// just means no links: the section stays hidden.
class StreamingLinksLoader extends ChangeNotifier {
  StreamingLinksLoader(this._repository);

  final StreamingRepository _repository;
  bool _disposed = false;

  bool loading = false;
  List<StreamingLink> links = const [];

  Future<void> load({
    List<String> barcodes = const [],
    String? artist,
    required String title,
  }) async {
    if (artist == null || artist.isEmpty || title.isEmpty) return;
    loading = true;
    notifyListeners();
    try {
      links = await _repository.links(
        barcodes: barcodes,
        artist: artist,
        title: title,
        locale: PlatformDispatcher.instance.locale.toLanguageTag(),
      );
    } on ApiException {
      links = const [];
    }
    loading = false;
    notifyListeners();
  }

  @override
  void notifyListeners() {
    if (!_disposed) super.notifyListeners();
  }

  @override
  void dispose() {
    _disposed = true;
    super.dispose();
  }
}
