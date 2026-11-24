import '../catalog/release.dart';

/// One enriched wantlist row as returned by `GET /api/wantlist`.
class WantEntry {
  const WantEntry({
    required this.discogsReleaseId,
    required this.rating,
    this.notes,
    required this.addedAt,
    required this.isCatalogAvailable,
    this.release,
  });

  factory WantEntry.fromJson(Map<String, Object?> json) => WantEntry(
    discogsReleaseId: json['discogsReleaseId'] as int,
    rating: json['rating'] as int,
    notes: json['notes'] as String?,
    addedAt: DateTime.parse(json['addedAt'] as String),
    isCatalogAvailable: json['catalogStatus'] == 'ok',
    release: json['release'] == null
        ? null
        : Release.fromJson(json['release'] as Map<String, Object?>),
  );

  final int discogsReleaseId;

  /// Personal rating, 0–5; 0 means unrated.
  final int rating;
  final String? notes;
  final DateTime addedAt;

  /// `catalogStatus == 'ok'`; false means [release] is null.
  final bool isCatalogAvailable;
  final Release? release;
}
