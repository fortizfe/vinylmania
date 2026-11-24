import 'package:material_ui/material_ui.dart';

import '../view_models/profile_view_model.dart';
import 'profile_compact_layout.dart';
import 'profile_expanded_layout.dart';

/// Appearance, Discogs connection and sign out (web `ProfilePage`).
class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key, required this.createViewModel});

  /// Called once, when the screen mounts; the screen owns the result.
  final ProfileViewModel Function() createViewModel;

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  late final ProfileViewModel _viewModel = widget.createViewModel()..load();

  @override
  void dispose() {
    _viewModel.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final expanded = MediaQuery.sizeOf(context).width >= 840;
    return ListenableBuilder(
      listenable: _viewModel,
      builder: (context, _) => expanded
          ? ProfileExpandedLayout(viewModel: _viewModel)
          : ProfileCompactLayout(viewModel: _viewModel),
    );
  }
}
