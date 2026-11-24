import 'package:flutter_test/flutter_test.dart';
import 'package:vinylmania/domain/models/feeds/article.dart';
import 'package:vinylmania/ui/dashboard/view_models/portada_slots.dart';

final _now = DateTime.utc(2024, 6, 2, 12);

/// [hoursAgo] orders by recency; [image] decides lead/tile eligibility.
Article _article(String id, String source, int hoursAgo, bool image) => Article(
  id: id,
  title: id,
  excerpt: '',
  imageUrl: image ? 'https://img.example/$id.jpg' : null,
  publishedAt: _now.subtract(Duration(hours: hoursAgo)),
  link: 'https://news.example/$id',
  sourceId: source,
  sourceName: source,
  category: 'Metal',
);

List<String> _ids(List<Article> a) => [for (final x in a) x.id];

void main() {
  test('lead is the newest article that has an image', () {
    final slots = assignPortadaSlots([
      _article('old-img', 'a', 5, true),
      _article('newest-no-img', 'b', 1, false),
      _article('new-img', 'c', 2, true),
    ]);

    expect(slots.lead?.id, 'new-img');
  });

  test('up to 4 secondaries, one per source while others have candidates', () {
    final slots = assignPortadaSlots([
      _article('a1', 'a', 1, true),
      _article('a2', 'a', 2, true),
      _article('b1', 'b', 3, true),
      _article('b2', 'b', 4, true),
      _article('c1', 'c', 5, true),
      _article('d1', 'd', 6, true),
      _article('e1', 'e', 7, true),
      _article('f1', 'f', 8, true),
    ]);

    expect(slots.lead?.id, 'a1');
    expect(slots.secondary, hasLength(4));
    expect({for (final a in slots.secondary) a.sourceId}, hasLength(4));
    expect(_ids(slots.secondary), isNot(contains('b2')));
    expect(_ids(slots.latest), contains('b2'));
  });

  test('relaxes one-per-source when a single source is all there is', () {
    final slots = assignPortadaSlots([
      for (final h in [1, 2, 3, 4, 5, 6]) _article('s$h', 'solo', h, true),
    ]);

    expect(slots.lead?.id, 's1');
    expect(_ids(slots.secondary), ['s2', 's3', 's4', 's5']);
    expect(_ids(slots.latest), ['s6']);
  });

  test('articles without an image never take the lead or a tile', () {
    final slots = assignPortadaSlots([
      _article('p1', 'a', 1, false),
      _article('p2', 'b', 2, false),
      _article('img', 'c', 3, true),
    ]);

    expect(slots.lead?.id, 'img');
    expect(slots.secondary, isEmpty);
    expect(_ids(slots.latest), ['p1', 'p2']);
  });

  test('the rest is newest first and every article is placed once', () {
    final input = [
      _article('l3', 'a', 30, false),
      _article('lead', 'b', 1, true),
      _article('l1', 'c', 10, false),
      _article('l2', 'd', 20, false),
    ];

    final slots = assignPortadaSlots(input);

    expect(_ids(slots.latest), ['l1', 'l2', 'l3']);
    expect(1 + slots.secondary.length + slots.latest.length, input.length);
    expect(slots.lead?.id, 'lead');
  });

  test('empty input', () {
    final slots = assignPortadaSlots([]);

    expect(slots.lead, isNull);
    expect(slots.secondary, isEmpty);
    expect(slots.latest, isEmpty);
  });
}
