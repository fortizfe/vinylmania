class Article {
  const Article({
    required this.id,
    required this.title,
    required this.excerpt,
    this.imageUrl,
    required this.publishedAt,
    required this.link,
    required this.sourceId,
    required this.sourceName,
    required this.category,
  });

  factory Article.fromJson(Map<String, Object?> json) => Article(
    id: json['id'] as String,
    title: json['title'] as String,
    excerpt: json['excerpt'] as String,
    imageUrl: json['imageUrl'] as String?,
    publishedAt: DateTime.parse(json['publishedAt'] as String),
    link: json['link'] as String,
    sourceId: json['sourceId'] as String,
    sourceName: json['sourceName'] as String,
    category: json['category'] as String,
  );

  final String id;
  final String title;
  final String excerpt;
  final String? imageUrl;
  final DateTime publishedAt;
  final String link;
  final String sourceId;
  final String sourceName;
  final String category;
}
