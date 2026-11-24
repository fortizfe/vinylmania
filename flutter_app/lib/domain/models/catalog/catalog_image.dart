class CatalogImage {
  const CatalogImage({
    required this.url,
    required this.imageType,
    this.width,
    this.height,
  });

  factory CatalogImage.fromJson(Map<String, Object?> json) => CatalogImage(
    url: json['url'] as String,
    imageType: json['imageType'] as String,
    width: json['width'] as int?,
    height: json['height'] as int?,
  );

  final String url;

  /// `primary` | `secondary`.
  final String imageType;
  final int? width;
  final int? height;
}
