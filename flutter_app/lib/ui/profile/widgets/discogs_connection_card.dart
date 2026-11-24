import 'package:intl/intl.dart';
import 'package:material_ui/material_ui.dart';

import '../../core/widgets/vm_badge.dart';
import '../../core/widgets/vm_button.dart';
import '../../core/widgets/vm_card.dart';
import '../view_models/profile_view_model.dart';
import 'discogs_card_heading.dart';
import 'discogs_connection_card_skeleton.dart';

/// Discogs link status with Connect, or Disconnect behind an inline
/// confirmation. Re-linking = disconnect + connect, as on the web.
class DiscogsConnectionCard extends StatelessWidget {
  const DiscogsConnectionCard({super.key, required this.viewModel});

  final ProfileViewModel viewModel;

  @override
  Widget build(BuildContext context) {
    final vm = viewModel;
    if (vm.isLoadingStatus) return const DiscogsConnectionCardSkeleton();
    final scheme = Theme.of(context).colorScheme;
    final muted = TextStyle(color: scheme.onSurfaceVariant);
    final status = vm.status;

    final List<Widget> body;
    if (status == null) {
      body = [
        Semantics(
          liveRegion: true,
          child: Text(
            'We could not load your Discogs connection right now. Please try '
            'again.',
            style: muted,
          ),
        ),
        VmButton.secondary(onPressed: vm.load, label: 'Retry'),
      ];
    } else if (!status.connected) {
      body = [
        Text(
          'Not connected. Link your Discogs account to prepare for collection '
          'syncing.',
          style: muted,
        ),
        VmButton.primary(
          onPressed: vm.link,
          label: 'Connect Discogs account',
          loading: vm.isLinking,
        ),
      ];
    } else {
      final linkedAt = status.linkedAt;
      body = [
        Wrap(
          spacing: 8,
          runSpacing: 4,
          crossAxisAlignment: WrapCrossAlignment.center,
          children: [
            const VmBadge(label: 'Connected'),
            Text(
              status.discogsUsername ?? '',
              style: TextStyle(
                color: scheme.onSurface,
                fontWeight: FontWeight.w500,
              ),
            ),
          ],
        ),
        if (linkedAt != null)
          Text(
            'Linked on ${DateFormat.yMMMMd().format(linkedAt.toLocal())}',
            style: muted,
          ),
        if (vm.isConfirmingDisconnect)
          Wrap(
            spacing: 12,
            runSpacing: 8,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              Text('Disconnect your Discogs account?', style: muted),
              VmButton.secondary(
                onPressed: vm.confirmDisconnect,
                label: 'Confirm disconnect',
                loading: vm.isDisconnecting,
              ),
              VmButton.secondary(
                onPressed: vm.isDisconnecting ? null : vm.cancelDisconnect,
                label: 'Keep connection',
              ),
            ],
          )
        else
          VmButton.secondary(onPressed: vm.askDisconnect, label: 'Disconnect'),
      ];
    }

    return VmCard(
      child: ConstrainedBox(
        constraints: const BoxConstraints(minHeight: 144),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const DiscogsCardHeading(),
            for (final child in body) ...[const SizedBox(height: 16), child],
          ],
        ),
      ),
    );
  }
}
