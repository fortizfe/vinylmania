import 'artist_credit.dart';
import 'catalog_image.dart';
import 'community_stats.dart';
import 'format_descriptor.dart';
import 'label_credit.dart';
import 'release_identifier.dart';
import 'track.dart';

class Release {
  const Release({
    required this.discogsId,
    required this.title,
    this.year,
    this.country,
    this.releaseDate,
    this.notes,
    required this.artists,
    required this.labels,
    required this.formats,
    required this.genres,
    required this.styles,
    required this.identifiers,
    this.community,
    required this.tracklist,
    required this.images,
    this.masterId,
    required this.discogsUrl,
  });

  factory Release.fromJson(Map<String, Object?> json) => Release(
    discogsId: json['discogsId'] as int,
    title: json['title'] as String,
    year: json['year'] as int?,
    country: json['country'] as String?,
    releaseDate: json['releaseDate'] as String?,
    notes: json['notes'] as String?,
    artists: _list(json['artists'], ArtistCredit.fromJson),
    labels: _list(json['labels'], LabelCredit.fromJson),
    formats: _list(json['formats'], FormatDescriptor.fromJson),
    genres: (json['genres'] as List).cast<String>(),
    styles: (json['styles'] as List).cast<String>(),
    identifiers: _list(json['identifiers'], ReleaseIdentifier.fromJson),
    community: json['community'] == null
        ? null
        : CommunityStats.fromJson(json['community'] as Map<String, Object?>),
    tracklist: _list(json['tracklist'], Track.fromJson),
    images: _list(json['images'], CatalogImage.fromJson),
    masterId: json['masterId'] as int?,
    discogsUrl: json['discogsUrl'] as String,
  );

  final int discogsId;
  final String title;
  final int? year;
  final String? country;
  final String? releaseDate;
  final String? notes;
  final List<ArtistCredit> artists;
  final List<LabelCredit> labels;
  final List<FormatDescriptor> formats;
  final List<String> genres;
  final List<String> styles;
  final List<ReleaseIdentifier> identifiers;
  final CommunityStats? community;
  final List<Track> tracklist;
  final List<CatalogImage> images;
  final int? masterId;
  final String discogsUrl;
}

List<T> _list<T>(Object? json, T Function(Map<String, Object?>) fromJson) => [
  for (final item in json as List) fromJson(item as Map<String, Object?>),
];
