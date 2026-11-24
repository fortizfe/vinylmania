import 'package:flutter_test/flutter_test.dart';
import 'package:vinylmania/ui/dashboard/widgets/article_age.dart';

void main() {
  final now = DateTime.utc(2024, 9, 20, 12);

  test('compact relative age, as the web formatArticleAge', () {
    String age(Duration ago) => formatArticleAge(now.subtract(ago), now);

    expect(age(const Duration(seconds: 30)), 'just now');
    expect(age(const Duration(minutes: 25)), '25m ago');
    expect(age(const Duration(hours: 3)), '3h ago');
    expect(age(const Duration(days: 2)), '2d ago');
    expect(formatArticleAge(DateTime(2024, 9, 12, 12), now), 'Sep 12');
  });

  test('full date for screen readers', () {
    expect(formatArticleFullDate(DateTime(2024, 6, 2, 12)), 'June 2, 2024');
  });
}
