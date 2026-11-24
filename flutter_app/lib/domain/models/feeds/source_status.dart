class SourceStatus {
  const SourceStatus({
    required this.sourceId,
    required this.sourceName,
    required this.isAvailable,
    required this.priority,
  });

  factory SourceStatus.fromJson(Map<String, Object?> json) => SourceStatus(
    sourceId: json['sourceId'] as String,
    sourceName: json['sourceName'] as String,
    isAvailable: json['status'] == 'ok',
    priority: json['priority'] as bool,
  );

  final String sourceId;
  final String sourceName;

  /// `status == 'ok'`; false means `unavailable`.
  final bool isAvailable;
  final bool priority;
}
