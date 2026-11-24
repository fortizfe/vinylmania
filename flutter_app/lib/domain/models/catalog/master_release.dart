import 'artist_credit.dart';
import 'catalog_image.dart';
import 'track.dart';

class MasterRelease {
  const MasterRelease({
    required this.discogsId,
    required this.title,
    this.year,
    required this.artists,
    required this.genres,
    required this.styles,
    required this.images,
    required this.tracklist,
    required this.mainReleaseId,
    required this.discogsUrl,
  });

  factory MasterRelease.fromJson(Map<String, Object?> json) => MasterRelease(
    discogsId: json['discogsId'] as int,
    title: json['title'] as String,
    year: json['year'] as int?,
    artists: [
      for (final a in json['artists'] as List)
        ArtistCredit.fromJson(a as Map<String, Object?>),
    ],
    genres: (json['genres'] as List).cast<String>(),
    styles: (json['styles'] as List).cast<String>(),
    images: [
      for (final i in json['images'] as List)
        CatalogImage.fromJson(i as Map<String, Object?>),
    ],
    tracklist: [
      for (final t in json['tracklist'] as List)
        Track.fromJson(t as Map<String, Object?>),
    ],
    mainReleaseId: json['mainReleaseId'] as int,
    discogsUrl: json['discogsUrl'] as String,
  );

  final int discogsId;
  final String title;
  final int? year;
  final List<ArtistCredit> artists;
  final List<String> genres;
  final List<String> styles;
  final List<CatalogImage> images;
  final List<Track> tracklist;
  final int mainReleaseId;
  final String discogsUrl;
}
