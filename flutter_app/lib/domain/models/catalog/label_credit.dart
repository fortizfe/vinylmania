class LabelCredit {
  const LabelCredit({
    required this.discogsLabelId,
    required this.name,
    this.catalogNumber,
  });

  factory LabelCredit.fromJson(Map<String, Object?> json) => LabelCredit(
    discogsLabelId: json['discogsLabelId'] as int,
    name: json['name'] as String,
    catalogNumber: json['catalogNumber'] as String?,
  );

  final int discogsLabelId;
  final String name;
  final String? catalogNumber;
}
