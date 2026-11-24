import 'package:flutter_test/flutter_test.dart';
import 'package:vinylmania/domain/models/auth/user_profile.dart';
import 'package:vinylmania/domain/models/auth/theme_preference.dart';

void main() {
  test('fromJson reads the full profile', () {
    final user = UserProfile.fromJson({
      'uid': 'u1',
      'displayName': 'Ada',
      'email': 'ada@example.com',
      'photoURL': 'https://img/1.png',
      'createdAt': '2025-01-01T00:00:00.000Z',
      'lastSignInAt': '2025-01-02T00:00:00.000Z',
      'themePreference': 'dark',
    });

    expect(user.uid, 'u1');
    expect(user.displayName, 'Ada');
    expect(user.email, 'ada@example.com');
    expect(user.photoUrl, 'https://img/1.png');
    expect(user.themePreference, ThemePreference.dark);
  });

  test('fromJson tolerates absent optional fields and unknown themes', () {
    final user = UserProfile.fromJson({
      'uid': 'u1',
      'displayName': 'Ada',
      'email': 'ada@example.com',
      'themePreference': 'sepia',
    });

    expect(user.photoUrl, isNull);
    expect(user.themePreference, isNull);
  });
}
