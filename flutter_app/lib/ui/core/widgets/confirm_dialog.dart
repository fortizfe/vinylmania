import 'package:material_ui/material_ui.dart';

/// Platform-adaptive confirmation (web `Modal` / `RemoveFromWantlistDialog`).
abstract final class ConfirmDialog {
  /// True only when the user confirms; cancel or dismiss → false.
  static Future<bool> show(
    BuildContext context, {
    required String title,
    required String message,
    required String confirmLabel,
    String cancelLabel = 'Cancel',
  }) async {
    final confirmed = await showAdaptiveDialog<bool>(
      context: context,
      barrierDismissible: true,
      builder: (context) => AlertDialog.adaptive(
        title: Text(title),
        content: Text(message),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: Text(cancelLabel),
          ),
          TextButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: Text(confirmLabel),
          ),
        ],
      ),
    );
    return confirmed ?? false;
  }
}
