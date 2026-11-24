import '../catalog/release.dart';
import 'copy_data.dart';
import 'wantlist_removal.dart';

class LibraryEntry {
  const LibraryEntry({
    required this.id,
    required this.discogsReleaseId,
    required this.addedAt,
    required this.isCatalogAvailable,
    this.release,
    this.discogs,
    this.genre = const [],
    this.style = const [],
    this.format = const [],
    this.wantlistRemoval,
  });

  factory LibraryEntry.fromJson(Map<String, Object?> json) => LibraryEntry(
    id: json['id'] as String,
    discogsReleaseId: json['discogsReleaseId'] as int,
    addedAt: DateTime.parse(json['addedAt'] as String),
    isCatalogAvailable: json['catalogStatus'] == 'ok',
    release: json['release'] == null
        ? null
        : Release.fromJson(json['release'] as Map<String, Object?>),
    discogs: json['discogs'] == null
        ? null
        : CopyData.fromJson(json['discogs'] as Map<String, Object?>),
    genre: (json['genre'] as List?)?.cast<String>() ?? const [],
    style: (json['style'] as List?)?.cast<String>() ?? const [],
    format: (json['format'] as List?)?.cast<String>() ?? const [],
    wantlistRemoval: switch (json['wantlistRemoval']) {
      'removed' => WantlistRemoval.removed,
      'not_in_wantlist' => WantlistRemoval.notInWantlist,
      'failed' => WantlistRemoval.failed,
      _ => null,
    },
  );

  final String id;
  final int discogsReleaseId;
  final DateTime addedAt;

  /// `catalogStatus == 'ok'`; false means [release] is null.
  final bool isCatalogAvailable;
  final Release? release;

  /// Null in list responses and when the copy is gone from Discogs.
  final CopyData? discogs;
  final List<String> genre;
  final List<String> style;
  final List<String> format;

  /// Only on the create response; null means "no action".
  final WantlistRemoval? wantlistRemoval;
}
