import '../utils/opening_hours.dart';

class PlaceResult {
  final String osmId;
  final String name;
  final String address;
  final String? phone;
  final String? openingHours;
  final double? distanceMeters;
  final double lat;
  final double lng;
  final int? priceLevel; // 1-4، من rico-api فقط (Overpass لا يوفرها)
  final double? rating; // 0-5، من rico-api فقط
  final int? ratingCount;

  PlaceResult({
    required this.osmId,
    required this.name,
    required this.address,
    required this.lat,
    required this.lng,
    this.phone,
    this.openingHours,
    this.distanceMeters,
    this.priceLevel,
    this.rating,
    this.ratingCount,
  });

  /// يبني عنصر مكان من استجابة Overpass API (OpenStreetMap)
  /// عنصر node يحتوي lat/lon مباشرة، وعنصر way/relation يحتوي center: {lat, lon}
  factory PlaceResult.fromOsmElement(Map<String, dynamic> json) {
    final tags = (json['tags'] ?? {}) as Map<String, dynamic>;

    double lat;
    double lng;
    if (json['type'] == 'node') {
      lat = (json['lat'] ?? 0).toDouble();
      lng = (json['lon'] ?? 0).toDouble();
    } else {
      final center = json['center'] ?? {};
      lat = (center['lat'] ?? 0).toDouble();
      lng = (center['lon'] ?? 0).toDouble();
    }

    // نبني عنوان مبسّط من حقول addr:* إن وجدت
    final addrParts = [
      tags['addr:street'],
      tags['addr:district'],
      tags['addr:city'],
    ].where((p) => p != null && p.toString().trim().isNotEmpty).toList();

    return PlaceResult(
      osmId: '${json['type']}/${json['id']}',
      name: (tags['name'] ?? tags['name:ar'] ?? 'مكان بدون اسم').toString(),
      address: addrParts.join('، '),
      lat: lat,
      lng: lng,
      phone: (tags['phone'] ?? tags['contact:phone'])?.toString(),
      openingHours: tags['opening_hours']?.toString(),
    );
  }

  /// يبني عنصر مكان من استجابة rico-api (GET /search) — قد تحتوي بيانات سعر
  /// وتقييم حقيقية غير متوفرة في Overpass.
  factory PlaceResult.fromRicoApiJson(Map<String, dynamic> json) {
    return PlaceResult(
      osmId: json['id'] as String,
      name: (json['nameAr'] ?? json['name']) as String,
      address: (json['address'] as String?) ?? '',
      lat: (json['lat'] as num).toDouble(),
      lng: (json['lng'] as num).toDouble(),
      phone: json['phone'] as String?,
      openingHours: json['openingHours'] as String?,
      distanceMeters: (json['distanceMeters'] as num?)?.toDouble(),
      priceLevel: json['priceLevel'] as int?,
      rating: (json['rating'] as num?)?.toDouble(),
      ratingCount: json['ratingCount'] as int?,
    );
  }

  PlaceResult copyWithDistance(double meters) {
    return PlaceResult(
      osmId: osmId,
      name: name,
      address: address,
      lat: lat,
      lng: lng,
      phone: phone,
      openingHours: openingHours,
      distanceMeters: meters,
      priceLevel: priceLevel,
      rating: rating,
      ratingCount: ratingCount,
    );
  }

  /// null = لا يمكن التأكد من حالة الفتح حالياً (صياغة opening_hours غير مدعومة)
  bool? get isOpenNow => OpeningHours.isOpenNow(openingHours, DateTime.now());

  String get distanceLabel {
    if (distanceMeters == null) return '';
    if (distanceMeters! < 1000) {
      return '${distanceMeters!.round()} م';
    }
    return '${(distanceMeters! / 1000).toStringAsFixed(1)} كم';
  }

  /// رمز السعر بتكرار رمز الريال حسب المستوى (1-4)، أو null إن لم تتوفر بيانات سعر.
  String? get priceLevelLabel =>
      priceLevel == null ? null : List.filled(priceLevel!, '﷼').join();

  String? get ratingLabel => rating == null ? null : '★ ${rating!.toStringAsFixed(1)}';

  /// رابط خرائط جوجل بالاعتماد على الإحداثيات فقط (بدون الحاجة لـ place_id مدفوع)
  String get googleMapsUrl =>
      'https://www.google.com/maps/search/?api=1&query=$lat,$lng';

  /// رابط اتجاهات فعلية من موقع المستخدم الحالي إلى المكان (لا يحتاج نقطة بداية،
  /// تطبيق خرائط جوجل يستخدم الموقع الحالي تلقائياً)
  String get directionsUrl =>
      'https://www.google.com/maps/dir/?api=1&destination=$lat,$lng';

  Map<String, dynamic> toJson() => {
        'osmId': osmId,
        'name': name,
        'address': address,
        'lat': lat,
        'lng': lng,
        'phone': phone,
        'openingHours': openingHours,
        'priceLevel': priceLevel,
        'rating': rating,
        'ratingCount': ratingCount,
      };

  factory PlaceResult.fromJson(Map<String, dynamic> json) {
    return PlaceResult(
      osmId: json['osmId'] as String,
      name: json['name'] as String,
      address: json['address'] as String,
      lat: (json['lat'] as num).toDouble(),
      lng: (json['lng'] as num).toDouble(),
      phone: json['phone'] as String?,
      openingHours: json['openingHours'] as String?,
      priceLevel: json['priceLevel'] as int?,
      rating: (json['rating'] as num?)?.toDouble(),
      ratingCount: json['ratingCount'] as int?,
    );
  }
}
