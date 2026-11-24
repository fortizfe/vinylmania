class FormatDescriptor {
  const FormatDescriptor({
    required this.name,
    this.quantity,
    required this.descriptions,
  });

  factory FormatDescriptor.fromJson(Map<String, Object?> json) =>
      FormatDescriptor(
        name: json['name'] as String,
        quantity: json['quantity'] as int?,
        descriptions: (json['descriptions'] as List).cast<String>(),
      );

  final String name;
  final int? quantity;
  final List<String> descriptions;
}
