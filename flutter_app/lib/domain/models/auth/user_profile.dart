import 'theme_preference.dart';

/// The signed-in user, as `GET /api/auth/me` returns it.
class UserProfile {
  const UserProfile({
    required this.uid,
    required this.displayName,
    required this.email,
    this.photoUrl,
    this.themePreference,
  });

  factory UserProfile.fromJson(Map<String, Object?> json) => UserProfile(
    uid: json['uid'] as String,
    displayName: json['displayName'] as String,
    email: json['email'] as String,
    photoUrl: json['photoURL'] as String?,
    themePreference: ThemePreference.values
        .asNameMap()[json['themePreference']],
  );

  final String uid;
  final String displayName;
  final String email;
  final String? photoUrl;
  final ThemePreference? themePreference;
}
