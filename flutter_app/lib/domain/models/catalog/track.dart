class Track {
  const Track({required this.position, required this.title, this.duration});

  factory Track.fromJson(Map<String, Object?> json) => Track(
    position: json['position'] as String,
    title: json['title'] as String,
    duration: json['duration'] as String?,
  );

  final String position;
  final String title;
  final String? duration;
}
