import '../../catalog_filter_options.dart';

/// Genre/style/format facets shared by catalog search and the library list.
class CatalogFilters {
  const CatalogFilters({
    this.genre = const {},
    this.style = const {},
    this.format = const {},
  });

  static const none = CatalogFilters();

  final Set<String> genre;
  final Set<String> style;
  final Set<String> format;

  bool get isEmpty => genre.isEmpty && style.isEmpty && format.isEmpty;

  /// Query params as the web sends them: comma-joined, canonical option order,
  /// empty facets omitted.
  Map<String, String> toQuery() => {
    for (final (name, selected, options) in [
      ('genre', genre, genreOptions),
      ('style', style, styleOptions),
      ('format', format, formatOptions),
    ])
      if (selected.isNotEmpty) name: options.where(selected.contains).join(','),
  };
}
