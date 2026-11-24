import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';
import 'package:provider/provider.dart';

import '../../../data/repositories/auth_repository.dart';
import 'pressable.dart';
import 'vm_avatar.dart';

/// The signed-in user's avatar; opens Profile.
class ProfileAvatarButton extends StatelessWidget {
  const ProfileAvatarButton({super.key});

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AuthRepository>().user;
    return Pressable(
      onTap: () => context.go('/profile'),
      semanticLabel: 'Profile',
      child: SizedBox.square(
        dimension: kMinInteractiveDimension,
        child: Center(
          child: ExcludeSemantics(
            child: VmAvatar(
              url: user?.photoUrl,
              semanticLabel: user?.displayName ?? '',
              size: 32,
            ),
          ),
        ),
      ),
    );
  }
}
