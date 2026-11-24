import 'package:flutter/foundation.dart';

import '../../../data/repositories/library_repository.dart';
import '../../../data/repositories/streaming_repository.dart';
import '../../../domain/api_exception.dart';
import '../../../domain/models/catalog/release.dart';
import '../../../domain/models/library/copy_data.dart';
import '../../../domain/models/library/library_entry.dart';
import 'copy_field.dart';
import 'detail_error.dart';
import 'detail_status.dart';
import 'save_status.dart';
import 'streaming_links_loader.dart';

/// Record detail (web `RecordDetailPage`): one library entry, its copy data
/// autosaved field by field, remove, and streaming links.
class RecordDetailViewModel extends ChangeNotifier {
  RecordDetailViewModel({
    required this.entryId,
    required this.libraryRepository,
    required this.streamingRepository,
  }) : streaming = StreamingLinksLoader(streamingRepository);

  final String entryId;
  final LibraryRepository libraryRepository;
  final StreamingRepository streamingRepository;
  final StreamingLinksLoader streaming;

  bool _disposed = false;
  final _saveStatus = <CopyField, SaveStatus>{};
  final _lastAttempt = <CopyField, Object>{};

  DetailStatus status = DetailStatus.loading;
  LibraryEntry? entry;

  /// Null when the copy is gone from Discogs: every field is read-only.
  CopyData? copy;

  /// Null when the catalog details are unavailable.
  Release? get release => entry?.release;

  bool removing = false;
  String? removeError;

  SaveStatus statusOf(CopyField field) => _saveStatus[field] ?? SaveStatus.idle;

  Future<void> load() async {
    status = DetailStatus.loading;
    notifyListeners();
    try {
      entry = await libraryRepository.get(entryId);
      copy = entry!.discogs;
      status = DetailStatus.ready;
    } on ApiException catch (e) {
      status = detailStatusFor(e);
    }
    notifyListeners();
    final loaded = release;
    if (loaded == null || _disposed) return;
    streaming.load(
      barcodes: [
        for (final id in loaded.identifiers)
          if (id.type == 'Barcode') id.value,
      ],
      artist: loaded.artists.firstOrNull?.name,
      title: loaded.title,
    );
  }

  Future<void> saveRating(int rating) => _save(CopyField.rating, rating);

  Future<void> saveMediaCondition(String value) async {
    if (copy?.mediaConditionEditable ?? false) {
      await _save(CopyField.mediaCondition, value);
    }
  }

  Future<void> saveSleeveCondition(String value) async {
    if (copy?.sleeveConditionEditable ?? false) {
      await _save(CopyField.sleeveCondition, value);
    }
  }

  Future<void> saveNotes(String value) async {
    final current = copy;
    if (current == null || !current.notesEditable) return;
    if (value == (current.notes ?? '')) return;
    await _save(CopyField.notes, value);
  }

  Future<void> retry(CopyField field) async {
    final value = _lastAttempt[field];
    if (value != null) await _save(field, value);
  }

  Future<void> _save(CopyField field, Object value) async {
    if (copy == null) return;
    _lastAttempt[field] = value;
    _saveStatus[field] = SaveStatus.saving;
    notifyListeners();
    try {
      final updated = await switch (field) {
        CopyField.rating => libraryRepository.updateCopy(
          entryId,
          rating: value as int,
        ),
        CopyField.mediaCondition => libraryRepository.updateCopy(
          entryId,
          mediaCondition: value as String,
        ),
        CopyField.sleeveCondition => libraryRepository.updateCopy(
          entryId,
          sleeveCondition: value as String,
        ),
        CopyField.notes => libraryRepository.updateCopy(
          entryId,
          notes: value as String,
        ),
      };
      copy = updated.discogs ?? copy;
      _saveStatus[field] = SaveStatus.saved;
    } on ApiException {
      _saveStatus[field] = SaveStatus.failed;
    }
    notifyListeners();
  }

  /// True once removed: the screen leaves.
  Future<bool> remove() async {
    if (removing) return false;
    removing = true;
    removeError = null;
    notifyListeners();
    try {
      await libraryRepository.remove(entryId);
      removing = false;
      return true;
    } on ApiException {
      removeError =
          'Something went wrong while removing this record. Please try again.';
      removing = false;
      notifyListeners();
      return false;
    }
  }

  @override
  void notifyListeners() {
    if (!_disposed) super.notifyListeners();
  }

  @override
  void dispose() {
    _disposed = true;
    streaming.dispose();
    super.dispose();
  }
}
