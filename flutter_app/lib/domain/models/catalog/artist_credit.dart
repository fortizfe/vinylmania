class ArtistCredit {
  const ArtistCredit({
    required this.discogsArtistId,
    required this.name,
    this.nameVariation,
    this.joinPhrase,
  });

  factory ArtistCredit.fromJson(Map<String, Object?> json) => ArtistCredit(
    discogsArtistId: json['discogsArtistId'] as int,
    name: json['name'] as String,
    nameVariation: json['nameVariation'] as String?,
    joinPhrase: json['joinPhrase'] as String?,
  );

  final int discogsArtistId;
  final String name;
  final String? nameVariation;
  final String? joinPhrase;
}
