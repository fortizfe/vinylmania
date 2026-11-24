import 'package:material_ui/material_ui.dart';

import '../../core/widgets/vm_card.dart';

/// A card with one muted sentence (not-found / unavailable states).
class DetailNotice extends StatelessWidget {
  const DetailNotice(this.text, {super.key});

  final String text;

  @override
  Widget build(BuildContext context) => SizedBox(
    width: double.infinity,
    child: VmCard(
      child: Text(
        text,
        style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant),
      ),
    ),
  );
}
