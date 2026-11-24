import '../../../domain/models/feeds/article.dart';

/// The front page's three slots, each newest first.
typedef PortadaSlots = ({
  Article? lead,
  List<Article> secondary,
  List<Article> latest,
});

const _secondaryCount = 4;

/// Web `assignPortadaSlots`: lead = newest article with an image; up to 4
/// secondaries = next newest with an image, one per source (lead's
/// included) while other sources have candidates, then relaxed; everything
/// else → latest.
PortadaSlots assignPortadaSlots(List<Article> articles) {
  // Stable newest-first (List.sort isn't stable; the web's sort is).
  final indexed = articles.indexed.toList()
    ..sort((a, b) {
      final byDate = b.$2.publishedAt.compareTo(a.$2.publishedAt);
      return byDate != 0 ? byDate : a.$1.compareTo(b.$1);
    });
  final sorted = [for (final (_, a) in indexed) a];
  final withImage = sorted.where((a) => a.imageUrl != null).toList();
  final lead = withImage.firstOrNull;
  final candidates = withImage.skip(1).toList();
  final picked = <Article>{};
  final usedSources = {?lead?.sourceId};

  for (final a in candidates) {
    if (picked.length < _secondaryCount && usedSources.add(a.sourceId)) {
      picked.add(a);
    }
  }
  for (final a in candidates) {
    if (picked.length < _secondaryCount) picked.add(a);
  }

  return (
    lead: lead,
    secondary: [
      for (final a in candidates)
        if (picked.contains(a)) a,
    ],
    latest: [
      for (final a in sorted)
        if (a != lead && !picked.contains(a)) a,
    ],
  );
}
