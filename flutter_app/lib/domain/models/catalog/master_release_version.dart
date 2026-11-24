class MasterReleaseVersion {
  const MasterReleaseVersion({
    required this.discogsId,
    required this.title,
    this.format,
    this.year,
    this.label,
    this.country,
    this.thumbnailUrl,
  });

  factory MasterReleaseVersion.fromJson(Map<String, Object?> json) =>
      MasterReleaseVersion(
        discogsId: json['discogsId'] as int,
        title: json['title'] as String,
        format: json['format'] as String?,
        year: json['year'] as int?,
        label: json['label'] as String?,
        country: json['country'] as String?,
        thumbnailUrl: json['thumbnailUrl'] as String?,
      );

  final int discogsId;
  final String title;
  final String? format;
  final int? year;
  final String? label;
  final String? country;
  final String? thumbnailUrl;
}
