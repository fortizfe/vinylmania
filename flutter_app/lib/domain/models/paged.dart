/// One page of a paginated backend list, normalised from both wire shapes
/// (`{items, page, pageSize, totalItems}` and `{results, pagination}`).
class Paged<T> {
  const Paged({
    required this.items,
    required this.page,
    required this.hasMore,
    this.totalItems,
  });

  final List<T> items;
  final int page;
  final bool hasMore;

  /// Total across all pages, when the endpoint reports it (library, wantlist).
  final int? totalItems;
}
