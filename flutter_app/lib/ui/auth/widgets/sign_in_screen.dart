import 'package:material_ui/material_ui.dart';

import '../view_models/sign_in_view_model.dart';
import 'sign_in_compact_layout.dart';
import 'sign_in_expanded_layout.dart';

/// Signed-out entry point (web `LandingPage`, condensed). Owns its
/// ViewModel so an in-flight sign-in survives route rebuilds.
class SignInScreen extends StatefulWidget {
  const SignInScreen({super.key, required this.createViewModel});

  /// Called once, when the screen mounts; the screen owns the result.
  final SignInViewModel Function() createViewModel;

  @override
  State<SignInScreen> createState() => _SignInScreenState();
}

class _SignInScreenState extends State<SignInScreen> {
  late final SignInViewModel _viewModel = widget.createViewModel();

  @override
  void dispose() {
    _viewModel.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final expanded = MediaQuery.sizeOf(context).width >= 840;
    return Scaffold(
      body: SafeArea(
        child: ListenableBuilder(
          listenable: _viewModel,
          builder: (context, _) => expanded
              ? SignInExpandedLayout(viewModel: _viewModel)
              : SignInCompactLayout(viewModel: _viewModel),
        ),
      ),
    );
  }
}
