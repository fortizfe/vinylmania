import 'package:vinylmania/domain/models/streaming/streaming_link.dart';

/// Wire shape of `GET /api/streaming/links`.

const streamingLinksJson = <String, Object?>{
  'links': [
    {'platform': 'apple_music', 'url': 'https://music.apple.com/album/123'},
  ],
};

const emptyStreamingLinksJson = <String, Object?>{'links': <Object?>[]};

final streamingLink = StreamingLink.fromJson(
  (streamingLinksJson['links']! as List).single as Map<String, Object?>,
);
