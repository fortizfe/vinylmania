import 'package:material_ui/material_ui.dart';

import '../../core/widgets/skeleton.dart';
import '../../core/widgets/vinylmania_wordmark.dart';

/// Shown while the stored session is restored.
class SplashScreen extends StatelessWidget {
  const SplashScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: Semantics(
          label: 'Loading Vinylmania',
          liveRegion: true,
          child: const ExcludeSemantics(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                VinylmaniaWordmark(fontSize: 48),
                SizedBox(height: 16),
                Skeleton(width: 120, height: 8),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
