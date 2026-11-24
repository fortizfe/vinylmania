/// Per-copy data held in the user's Discogs collection. An `*Editable` flag
/// is false when the matching Discogs custom field was deleted on discogs.com.
class CopyData {
  const CopyData({
    required this.instanceId,
    required this.folderId,
    required this.rating,
    this.mediaCondition,
    this.sleeveCondition,
    this.notes,
    required this.mediaConditionEditable,
    required this.sleeveConditionEditable,
    required this.notesEditable,
  });

  factory CopyData.fromJson(Map<String, Object?> json) {
    final editable = json['editable'] as Map<String, Object?>;
    return CopyData(
      instanceId: json['instanceId'] as int,
      folderId: json['folderId'] as int,
      rating: json['rating'] as int,
      mediaCondition: json['mediaCondition'] as String?,
      sleeveCondition: json['sleeveCondition'] as String?,
      notes: json['notes'] as String?,
      mediaConditionEditable: editable['mediaCondition'] as bool,
      sleeveConditionEditable: editable['sleeveCondition'] as bool,
      notesEditable: editable['notes'] as bool,
    );
  }

  final int instanceId;
  final int folderId;

  /// 0–5; 0 means unrated.
  final int rating;
  final String? mediaCondition;
  final String? sleeveCondition;
  final String? notes;
  final bool mediaConditionEditable;
  final bool sleeveConditionEditable;
  final bool notesEditable;
}
