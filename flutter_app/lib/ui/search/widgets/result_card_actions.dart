import 'package:material_ui/material_ui.dart';

import '../../core/widgets/vm_button.dart';

/// Web `ResultCardActions`: "Add to library" (plus → check) and "Add to
/// wishlist" (outline → filled heart). State shows in label + icon.
class ResultCardActions extends StatelessWidget {
  const ResultCardActions({
    super.key,
    required this.adding,
    required this.added,
    required this.onAdd,
    required this.addingToWishlist,
    required this.inWishlist,
    required this.onAddToWishlist,
  });

  final bool adding;
  final bool added;
  final VoidCallback onAdd;
  final bool addingToWishlist;
  final bool inWishlist;
  final VoidCallback onAddToWishlist;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        VmButton.icon(
          onPressed: added ? null : onAdd,
          loading: adding,
          label: added ? 'Added to library' : 'Add to library',
          icon: added ? Icons.check : Icons.add,
        ),
        const SizedBox(width: 8),
        VmButton.icon(
          onPressed: inWishlist ? null : onAddToWishlist,
          loading: addingToWishlist,
          label: inWishlist ? 'In your wishlist' : 'Add to wishlist',
          icon: inWishlist ? Icons.favorite : Icons.favorite_border,
        ),
      ],
    );
  }
}
