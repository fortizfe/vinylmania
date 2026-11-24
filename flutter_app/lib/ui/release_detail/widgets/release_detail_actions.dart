import 'package:material_ui/material_ui.dart';

import '../../core/widgets/discogs_link_gate.dart';
import '../../core/widgets/vm_button.dart';
import '../view_models/release_detail_view_model.dart';
import 'error_line.dart';
import 'status_line.dart';

/// Web `RecordDetailActions` (search / wishlist views): Add to library, plus
/// Add to wishlist while the release isn't in it; gate, notice and errors.
class ReleaseDetailActions extends StatelessWidget {
  const ReleaseDetailActions({super.key, required this.viewModel});

  final ReleaseDetailViewModel viewModel;

  @override
  Widget build(BuildContext context) {
    final vm = viewModel;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      spacing: 8,
      children: [
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            VmButton.primary(
              onPressed: vm.addedToLibrary ? null : vm.addToLibrary,
              loading: vm.addingToLibrary,
              label: vm.addedToLibrary ? 'Added to library' : 'Add to library',
            ),
            if (!vm.isInWantlist)
              VmButton.secondary(
                onPressed: vm.addedToWishlist ? null : vm.addToWishlist,
                loading: vm.addingToWishlist,
                label: vm.addedToWishlist
                    ? 'Added to wishlist'
                    : 'Add to wishlist',
              ),
          ],
        ),
        if (vm.gate case final gate?)
          DiscogsLinkGate(relink: gate.relink, context: gate.context),
        if (vm.notice case final notice?) StatusLine(notice),
        if (vm.libraryError case final error?) ErrorLine(error),
        if (vm.wishlistError case final error? when !vm.isInWantlist)
          ErrorLine(error),
      ],
    );
  }
}
