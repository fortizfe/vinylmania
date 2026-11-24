import 'package:material_ui/material_ui.dart';

import '../../core/widgets/vm_button.dart';
import '../view_models/sign_in_view_model.dart';

/// "Continue with Google" + the outcome message below it. Placed last in
/// both layouts so the message never pushes content down.
class SignInAction extends StatelessWidget {
  const SignInAction({super.key, required this.viewModel});

  final SignInViewModel viewModel;

  @override
  Widget build(BuildContext context) {
    final message = viewModel.errorMessage;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        VmButton.primary(
          onPressed: viewModel.signIn,
          label: 'Continue with Google',
          loading: viewModel.isSigningIn,
        ),
        if (message != null) ...[
          const SizedBox(height: 12),
          Semantics(
            liveRegion: true,
            child: Text(
              message,
              textAlign: TextAlign.center,
              style: TextStyle(color: Theme.of(context).colorScheme.error),
            ),
          ),
        ],
      ],
    );
  }
}
