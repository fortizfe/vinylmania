class ReleaseIdentifier {
  const ReleaseIdentifier({
    required this.type,
    required this.value,
    this.description,
  });

  factory ReleaseIdentifier.fromJson(Map<String, Object?> json) =>
      ReleaseIdentifier(
        type: json['type'] as String,
        value: json['value'] as String,
        description: json['description'] as String?,
      );

  /// e.g. `Barcode`, `Matrix / Runout`.
  final String type;
  final String value;
  final String? description;
}
