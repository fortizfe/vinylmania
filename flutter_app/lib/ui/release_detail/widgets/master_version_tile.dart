import 'package:material_ui/material_ui.dart';

import '../../../domain/models/catalog/master_release_version.dart';
import '../../core/widgets/vm_card.dart';

/// Compact versions row (web mobile card): title + "format · year · label ·
/// country".
class MasterVersionTile extends StatelessWidget {
  const MasterVersionTile({
    super.key,
    required this.version,
    required this.onTap,
  });

  final MasterReleaseVersion version;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final v = version;
    final meta = [
      ?v.format,
      if (v.year case final year?) '$year',
      ?v.label,
      ?v.country,
    ].join(' · ');
    return VmCard(
      onTap: onTap,
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      child: ConstrainedBox(
        constraints: const BoxConstraints(minHeight: kMinInteractiveDimension),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.center,
          spacing: 2,
          children: [
            Text(
              v.title,
              style: TextStyle(
                color: scheme.onSurface,
                fontWeight: FontWeight.w500,
              ),
            ),
            Text(
              meta.isEmpty ? '—' : meta,
              style: TextStyle(color: scheme.onSurfaceVariant),
            ),
          ],
        ),
      ),
    );
  }
}
