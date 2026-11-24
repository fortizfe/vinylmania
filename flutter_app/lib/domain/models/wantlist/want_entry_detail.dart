/// `GET/PATCH /api/wantlist/:releaseId`: the personal rating and notes.
class WantEntryDetail {
  const WantEntryDetail({
    required this.discogsReleaseId,
    required this.rating,
    this.notes,
    required this.addedAt,
  });

  factory WantEntryDetail.fromJson(Map<String, Object?> json) =>
      WantEntryDetail(
        discogsReleaseId: json['discogsReleaseId'] as int,
        rating: json['rating'] as int,
        notes: json['notes'] as String?,
        addedAt: DateTime.parse(json['addedAt'] as String),
      );

  final int discogsReleaseId;

  /// 0–5; 0 means unrated.
  final int rating;
  final String? notes;
  final DateTime addedAt;
}
