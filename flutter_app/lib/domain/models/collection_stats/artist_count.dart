class ArtistCount {
  const ArtistCount({required this.name, required this.count});

  factory ArtistCount.fromJson(Map<String, Object?> json) =>
      ArtistCount(name: json['name'] as String, count: json['count'] as int);

  final String name;
  final int count;
}
