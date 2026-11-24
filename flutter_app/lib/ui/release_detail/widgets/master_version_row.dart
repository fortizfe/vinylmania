import 'package:material_ui/material_ui.dart';

import '../../../domain/models/catalog/master_release_version.dart';
import '../../core/widgets/pressable.dart';

/// Expanded versions table row: Title · Format · Year · Label · Country.
/// With [version] null it renders the header.
class MasterVersionRow extends StatelessWidget {
  const MasterVersionRow({super.key, this.version, this.onTap});

  final MasterReleaseVersion? version;
  final VoidCallback? onTap;

  static const _flex = [4, 3, 1, 2, 2];

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final v = version;
    final cells = v == null
        ? const ['Title', 'Format', 'Year', 'Label', 'Country']
        : [
            v.title,
            v.format ?? '—',
            v.year?.toString() ?? '—',
            v.label ?? '—',
            v.country ?? '—',
          ];
    final row = ConstrainedBox(
      constraints: const BoxConstraints(minHeight: kMinInteractiveDimension),
      child: Row(
        spacing: 16,
        children: [
          for (var i = 0; i < cells.length; i++)
            Expanded(
              flex: _flex[i],
              child: Text(
                cells[i],
                style: TextStyle(
                  color: v != null && i == 0
                      ? scheme.onSurface
                      : scheme.onSurfaceVariant,
                  fontWeight: i == 0 || v == null ? FontWeight.w500 : null,
                ),
              ),
            ),
        ],
      ),
    );
    if (v == null) return ExcludeSemantics(child: row);
    return DecoratedBox(
      decoration: BoxDecoration(
        border: Border(top: BorderSide(color: scheme.outlineVariant)),
      ),
      child: Pressable(onTap: onTap, pressedScale: 0.99, child: row),
    );
  }
}
