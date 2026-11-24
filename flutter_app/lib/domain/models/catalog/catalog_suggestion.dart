class CatalogSuggestion {
  const CatalogSuggestion({
    required this.discogsId,
    required this.resultType,
    required this.title,
    this.artist,
    this.year,
    this.format,
    this.thumbnailUrl,
  });

  factory CatalogSuggestion.fromJson(Map<String, Object?> json) =>
      CatalogSuggestion(
        discogsId: json['discogsId'] as int,
        resultType: json['resultType'] as String,
        title: json['title'] as String,
        artist: json['artist'] as String?,
        year: json['year'] as int?,
        format: json['format'] as String?,
        thumbnailUrl: json['thumbnailUrl'] as String?,
      );

  final int discogsId;

  /// `release` | `master` | `artist`: decides where a pick navigates.
  final String resultType;
  final String title;
  final String? artist;
  final int? year;
  final String? format;
  final String? thumbnailUrl;
}
