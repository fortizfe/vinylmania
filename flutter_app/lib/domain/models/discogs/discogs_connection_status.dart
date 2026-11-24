/// `GET /api/discogs/oauth/status`.
class DiscogsConnectionStatus {
  const DiscogsConnectionStatus({
    required this.connected,
    this.discogsUsername,
    this.linkedAt,
  });

  factory DiscogsConnectionStatus.fromJson(Map<String, Object?> json) =>
      DiscogsConnectionStatus(
        connected: json['connected'] as bool,
        discogsUsername: json['discogsUsername'] as String?,
        linkedAt: json['linkedAt'] == null
            ? null
            : DateTime.parse(json['linkedAt'] as String),
      );

  final bool connected;

  /// Set when [connected].
  final String? discogsUsername;

  /// Set when [connected].
  final DateTime? linkedAt;
}
