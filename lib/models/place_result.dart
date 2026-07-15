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

  PlaceResult({
    required this.osmId,
    required this.name,
    required this.address,
    required this.lat,
    required this.lng,
    this.phone,
    this.openingHours,
    this.distanceMeters,
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
    );
  }
}
