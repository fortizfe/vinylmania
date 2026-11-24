import 'article.dart';

class CategoryGroup {
  const CategoryGroup({required this.category, required this.articles});

  factory CategoryGroup.fromJson(Map<String, Object?> json) => CategoryGroup(
    category: json['category'] as String,
    articles: [
      for (final a in json['articles'] as List)
        Article.fromJson(a as Map<String, Object?>),
    ],
  );

  final String category;
  final List<Article> articles;
}
