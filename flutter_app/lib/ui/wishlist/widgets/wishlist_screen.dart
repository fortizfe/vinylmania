import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';

import '../../../domain/models/wantlist/want_entry.dart';
import '../../core/widgets/confirm_dialog.dart';
import '../../core/widgets/discogs_link_gate.dart';
import '../../core/widgets/error_retry_card.dart';
import '../../core/widgets/page_title.dart';
import '../../core/widgets/vm_button.dart';
import '../../core/widgets/vm_card.dart';
import '../../library/widgets/card_grid_sliver.dart';
import '../../library/widgets/record_card_skeleton.dart';
import '../view_models/wishlist_view_model.dart';
import 'wishlist_card.dart';

/// Web `WishlistPage`. Compact and expanded differ in padding and grid
/// columns.
class WishlistScreen extends StatefulWidget {
  const WishlistScreen({super.key, required this.createViewModel});

  /// Called once, when the screen mounts; the screen owns the result.
  final WishlistViewModel Function() createViewModel;

  @override
  State<WishlistScreen> createState() => _WishlistScreenState();
}

class _WishlistScreenState extends State<WishlistScreen> {
  late final WishlistViewModel _vm = widget.createViewModel();

  @override
  void initState() {
    super.initState();
    _vm.load();
  }

  @override
  void dispose() {
    _vm.dispose();
    super.dispose();
  }

  Future<void> _confirmRemove(WantEntry entry) async {
    final confirmed = await ConfirmDialog.show(
      context,
      title: 'Remove from wishlist?',
      message:
          'Remove “${entry.release?.title ?? 'this record'}” from your '
          'wishlist? This removes it from your Discogs wantlist too.',
      confirmLabel: 'Remove',
    );
    if (confirmed) await _vm.remove(entry.discogsReleaseId);
  }

  @override
  Widget build(BuildContext context) {
    final compact = MediaQuery.sizeOf(context).width < 840;
    final pad = compact ? 16.0 : 32.0;
    return ListenableBuilder(
      listenable: _vm,
      builder: (context, _) {
        if (_vm.isGated) {
          return ListView(
            padding: EdgeInsets.all(pad),
            children: [
              const PageTitle('Your wishlist'),
              const SizedBox(height: 24),
              DiscogsLinkGate(relink: _vm.needsRelink, context: 'wishlist'),
            ],
          );
        }
        final theme = Theme.of(context);
        final error = TextStyle(color: theme.colorScheme.error);
        final entries = _vm.entries;
        Widget alert(String text) => Padding(
          padding: const EdgeInsets.only(top: 16),
          child: Semantics(liveRegion: true, child: Text(text, style: error)),
        );

        return CustomScrollView(
          slivers: [
            SliverPadding(
              padding: EdgeInsets.fromLTRB(pad, pad, pad, 16),
              sliver: SliverList.list(
                children: [
                  Row(
                    children: [
                      const Expanded(child: PageTitle('Your wishlist')),
                      const SizedBox(width: 16),
                      VmButton.secondary(
                        onPressed: _vm.refresh,
                        loading: _vm.isRefreshing,
                        label: 'Refresh',
                      ),
                    ],
                  ),
                  if (_vm.refreshFailed)
                    alert(
                      "Couldn't refresh from Discogs right now. "
                      'Please try again.',
                    ),
                  if (_vm.removeFailed)
                    alert("Couldn't remove it right now. Please try again."),
                  if (_vm.loadError != null) ...[
                    const SizedBox(height: 16),
                    ErrorRetryCard(
                      message:
                          'Something went wrong while loading your '
                          'wishlist. Please try again.',
                      onRetry: _vm.load,
                    ),
                  ] else if (!_vm.isLoading && entries.isEmpty) ...[
                    const SizedBox(height: 16),
                    VmCard(
                      child: Text(
                        'Nothing on your wishlist yet. Add a release from '
                        'search or its detail page.',
                        style: TextStyle(
                          color: theme.colorScheme.onSurfaceVariant,
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            ),
            if (_vm.loadError == null && (_vm.isLoading || entries.isNotEmpty))
              SliverPadding(
                padding: EdgeInsets.symmetric(horizontal: pad),
                sliver: CardGridSliver(
                  itemCount: _vm.isLoading ? 8 : entries.length,
                  minTileWidth: compact ? 160 : 200,
                  itemBuilder: (context, i) {
                    if (_vm.isLoading) {
                      return const RecordCardSkeleton(
                        footerHeight: kMinInteractiveDimension,
                      );
                    }
                    final entry = entries[i];
                    return WishlistCard(
                      entry: entry,
                      onOpen: () =>
                          context.push('/releases/${entry.discogsReleaseId}'),
                      onRemove: () => _confirmRemove(entry),
                    );
                  },
                ),
              ),
            if (_vm.loadError == null && !_vm.isLoading && entries.isNotEmpty)
              SliverPadding(
                padding: EdgeInsets.fromLTRB(pad, 16, pad, pad),
                sliver: SliverToBoxAdapter(
                  child: Wrap(
                    spacing: 12,
                    runSpacing: 12,
                    children: [
                      VmButton.secondary(
                        onPressed: _vm.hasPrevious ? _vm.previousPage : null,
                        label: 'Previous',
                      ),
                      VmButton.secondary(
                        onPressed: _vm.hasNext ? _vm.nextPage : null,
                        label: 'Next',
                      ),
                    ],
                  ),
                ),
              ),
          ],
        );
      },
    );
  }
}
