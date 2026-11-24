import 'package:material_ui/material_ui.dart';

import '../../core/widgets/discogs_link_gate.dart';
import '../view_models/search_view_model.dart';

/// Outcome of the last add action, pinned above the results so it stays
/// visible however far the list is scrolled: the gate, a note or an error.
class SearchFeedback extends StatelessWidget {
  const SearchFeedback({super.key, this.gate, this.notice, this.error});

  final SearchGate? gate;
  final String? notice;
  final String? error;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final gate = this.gate;
    final Widget? child = gate != null
        ? DiscogsLinkGate(relink: gate.relink, context: gate.context)
        : error != null
        ? Text(error!, style: TextStyle(color: scheme.error))
        : notice != null
        ? Text(notice!, style: TextStyle(color: scheme.onSurfaceVariant))
        : null;
    if (child == null) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(top: 12),
      child: Semantics(liveRegion: true, child: child),
    );
  }
}
