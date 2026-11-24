class StatBucket {
  const StatBucket({required this.label, required this.count});

  factory StatBucket.fromJson(Map<String, Object?> json) =>
      StatBucket(label: json['label'] as String, count: json['count'] as int);

  final String label;
  final int count;
}
