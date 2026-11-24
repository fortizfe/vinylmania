import 'package:intl/intl.dart';

/// Formatting shared by the stats widgets (the web's `formatCount`,
/// `formatCurrency`, `formatPeriod`).

final _count = NumberFormat.decimalPattern('en_US');
final _plain = NumberFormat('#,##0.00');
const _months = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

String formatCount(int value) => _count.format(value);

String records(int count) => count == 1 ? 'record' : 'records';

/// In the Discogs account currency; a plain 2-decimal number until the
/// first disc is priced.
String formatCurrency(double value, String? currency) => currency == null
    ? _plain.format(value)
    : NumberFormat.simpleCurrency(name: currency).format(value);

/// `YYYY-MM` → `Mon YYYY`, locale-independent like the web.
String formatPeriod(String period) {
  final [year, month] = period.split('-');
  final index = (int.tryParse(month) ?? 0) - 1;
  return index >= 0 && index < 12 ? '${_months[index]} $year' : period;
}
