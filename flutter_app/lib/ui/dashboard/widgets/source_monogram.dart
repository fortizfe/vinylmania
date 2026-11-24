/// Initials of the first two words, e.g. "Metal Underground" → "MU" (web
/// `sourceMonogram`).
String sourceMonogram(String name) {
  final words = name.trim().split(RegExp(r'\s+')).where((w) => w.isNotEmpty);
  return words.isEmpty
      ? '?'
      : words.take(2).map((w) => w[0].toUpperCase()).join();
}
