import 'dart:convert';
import 'package:http/http.dart' as http;
import '../models/place_result.dart';
import 'intent_service.dart';
import 'location_service.dart';

class PlacesException implements Exception {
  final String message;
  PlacesException(this.message);
  @override
  String toString() => message;
}

/// خدمة البحث عن الأماكن باستخدام Overpass API (OpenStreetMap)
/// مجانية 100%، بدون مفتاح API، بدون بطاقة ائتمان.
/// المرجع: https://wiki.openstreetmap.org/wiki/Overpass_API
class PlacesService {
  final LocationService _locationService = LocationService();

  // نستخدم عدة مرايا مجانية، وننتقل للتالية عند فشل أو ازدحام أي منها
  static const List<String> _endpoints = [
    'https://overpass.kumi.systems/api/interpreter',
    'https://overpass.openstreetmap.fr/api/interpreter',
    'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
    'https://overpass-api.de/api/interpreter',
  ];

  // رموز الأخطاء المؤقتة (ازدحام/انشغال الخادم) التي تستحق إعادة المحاولة
  static const Set<int> _retryableStatusCodes = {406, 429, 500, 502, 503, 504};

  // أقل عدد نتائج نعتبره كافياً؛ إذا كانت النتائج أقل نوسّع نطاق البحث تلقائياً
  // (نتيجة واحدة ليست خيارات كافية للمستخدم، حتى لو لم تكن القائمة فارغة)
  static const int _minDesiredResults = 3;

  // مستويات نطاق تصاعدية نجربها إذا لم نصل للحد الأدنى من النتائج
  // (بيانات OSM قد تكون متفرقة في بعض المناطق، فنطاق أوسع يكشف نتائج فعلية أكثر)
  static const List<int> _widerRadiiMeters = [8000, 15000];

  Future<List<PlaceResult>> search({
    required double userLat,
    required double userLng,
    required List<OsmTag> tags,
    bool cheapest = false,
    int radiusMeters = 3000,
  }) async {
    var results = await _searchOnce(
      userLat: userLat,
      userLng: userLng,
      tags: tags,
      radiusMeters: radiusMeters,
    );

    for (final widerRadius in _widerRadiiMeters) {
      if (results.length >= _minDesiredResults || widerRadius <= radiusMeters) {
        break;
      }
      results = await _searchOnce(
        userLat: userLat,
        userLng: userLng,
        tags: tags,
        radiusMeters: widerRadius,
      );
    }

    return results;
  }

  Future<List<PlaceResult>> _searchOnce({
    required double userLat,
    required double userLng,
    required List<OsmTag> tags,
    required int radiusMeters,
  }) async {
    final filters = tags
        .map((t) => '''
  node["${t.key}"="${t.value}"](around:$radiusMeters,$userLat,$userLng);
  way["${t.key}"="${t.value}"](around:$radiusMeters,$userLat,$userLng);''')
        .join('\n');

    final query = '''
[out:json][timeout:25];
(
$filters
);
out center tags;
''';

    Exception? lastError;

    for (final endpoint in _endpoints) {
      http.Response? response;

      // إعادة محاولة واحدة على نفس المرآة إذا كان الخطأ ازدحاماً مؤقتاً
      for (var attempt = 0; attempt < 2; attempt++) {
        try {
          response = await http
              .post(
                Uri.parse(endpoint),
                body: {'data': query},
              )
              .timeout(const Duration(seconds: 15));

          if (response.statusCode == 200 ||
              !_retryableStatusCodes.contains(response.statusCode)) {
            break;
          }
        } catch (e) {
          response = null;
        }

        if (attempt == 0) {
          await Future.delayed(const Duration(seconds: 1));
        }
      }

      if (response == null) {
        lastError = PlacesException('تعذر الوصول للخادم، جاري تجربة خادم بديل...');
        continue;
      }

      if (response.statusCode != 200) {
        lastError = PlacesException(
            'تعذر الاتصال بخدمة الأماكن المجانية حالياً (رمز ${response.statusCode})');
        continue;
      }

      try {
        final data = jsonDecode(utf8.decode(response.bodyBytes));
        final elements = (data['elements'] as List?) ?? [];

        if (elements.isEmpty) {
          return [];
        }

        final results = elements
            .map((e) => PlaceResult.fromOsmElement(e as Map<String, dynamic>))
            .where((p) => p.lat != 0 && p.lng != 0) // تجاهل عناصر بدون إحداثيات
            .map((place) {
          final distance = _locationService.distanceInMeters(
              userLat, userLng, place.lat, place.lng);
          return place.copyWithDistance(distance);
        }).toList();

        // نرتب دوماً حسب الأقرب مسافة (مصدر البيانات المجاني لا يوفر بيانات
        // سعر/تقييم موثوقة بما يكفي للترتيب حسب "الأرخص" بدقة)
        results.sort((a, b) =>
            (a.distanceMeters ?? 0).compareTo(b.distanceMeters ?? 0));

        return results.take(8).toList();
      } catch (e) {
        lastError = PlacesException('تعذر الوصول للخادم، جاري تجربة خادم بديل...');
        continue;
      }
    }

    throw lastError ?? PlacesException('تعذر الاتصال بخدمة الأماكن حالياً.');
  }
}
