import 'package:material_ui/material_ui.dart';

import 'vm_button.dart';
import 'vm_card.dart';

/// User-facing error with a real Retry, announced when it appears.
class ErrorRetryCard extends StatelessWidget {
  const ErrorRetryCard({
    super.key,
    required this.message,
    required this.onRetry,
  });

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return VmCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Semantics(
            liveRegion: true,
            child: Text(
              message,
              style: TextStyle(color: Theme.of(context).colorScheme.onSurface),
            ),
          ),
          const SizedBox(height: 12),
          VmButton.secondary(onPressed: onRetry, label: 'Retry'),
        ],
      ),
    );
  }
}
