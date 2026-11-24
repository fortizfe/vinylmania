class StreamingLink {
  const StreamingLink({required this.platform, required this.url});

  factory StreamingLink.fromJson(Map<String, Object?> json) => StreamingLink(
    platform: json['platform'] as String,
    url: json['url'] as String,
  );

  /// Only `apple_music` today; widens as backend resolvers land.
  final String platform;
  final String url;
}
