import 'package:flutter_test/flutter_test.dart';
import 'package:vinylmania/ui/dashboard/widgets/source_monogram.dart';

void main() {
  test('initials of the first two words, as the web sourceMonogram', () {
    expect(sourceMonogram('Metal Underground'), 'MU');
    expect(sourceMonogram('MetalSucks'), 'M');
    expect(sourceMonogram('Heavy Metal Overload'), 'HM');
    expect(sourceMonogram('  Metal Underground  '), 'MU');
    expect(sourceMonogram(''), '?');
  });
}
