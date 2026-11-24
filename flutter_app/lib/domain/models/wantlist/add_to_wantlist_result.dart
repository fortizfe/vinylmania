import 'want_entry.dart';

/// `POST /api/wantlist` (201): the entry plus two reconciliation flags.
class AddToWantlistResult {
  const AddToWantlistResult({
    required this.entry,
    required this.alreadyInWantlist,
    required this.alreadyInLibrary,
  });

  factory AddToWantlistResult.fromJson(Map<String, Object?> json) =>
      AddToWantlistResult(
        entry: WantEntry.fromJson(json),
        alreadyInWantlist: json['alreadyInWantlist'] as bool,
        alreadyInLibrary: json['alreadyInLibrary'] as bool,
      );

  final WantEntry entry;

  /// The release was already a want (idempotent add).
  final bool alreadyInWantlist;

  /// The caller already owns the release; the library is not modified.
  final bool alreadyInLibrary;
}
