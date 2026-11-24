import 'package:intl/intl.dart';

const _minute = Duration(minutes: 1);
const _hour = Duration(hours: 1);
const _day = Duration(days: 1);

/// Compact relative age (web `formatArticleAge`): "just now" / "25m ago" /
/// "3h ago" / "2d ago" / "Sep 12".
String formatArticleAge(DateTime published, DateTime now) {
  final diff = now.difference(published);
  if (diff < _minute) return 'just now';
  if (diff < _hour) return '${diff.inMinutes}m ago';
  if (diff < _day) return '${diff.inHours}h ago';
  if (diff < _day * 7) return '${diff.inDays}d ago';
  return DateFormat.MMMd('en_US').format(published.toLocal());
}

/// "June 2, 2024": what screen readers hear instead of the relative age.
String formatArticleFullDate(DateTime published) =>
    DateFormat.yMMMMd('en_US').format(published.toLocal());
