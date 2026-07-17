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

  // نطاق أوسع نجربه مرة واحدة فقط إذا لم نصل للحد الأدنى من النتائج
  // (بيانات OSM قد تكون متفرقة في بعض المناطق) — خطوة واحدة فقط حتى لا يتضاعف
  // زمن الانتظار عبر عدة محاولات شبكة متتالية
  static const List<int> _widerRadiiMeters = [8000];

  // أحرف regex الخاصة التي يجب تهريبها قبل تضمين نص حر (اسم علامة تجارية) في
  // استعلام Overpass QL — نتعامل معه كنص حرفي وليس كـ regex يتحكم به المستخدم
  static const String _regexMetachars = r'\.^$|?*+()[]{}';

  /// يهرّب/يرفض نص العلامة التجارية قبل تضمينه في استعلام Overpass QL.
  /// يرجع null إذا كان النص فارغاً أو طويلاً جداً أو يحتوي أحرف تحكّم قد
  /// تكسر بنية الاستعلام.
  static String? _sanitizeBrandHint(String hint) {
    final trimmed = hint.trim();
    if (trimmed.isEmpty || trimmed.length > 60) return null;
    if (trimmed.codeUnits.any((c) => c < 0x20)) return null;

    final buffer = StringBuffer();
    for (final rune in trimmed.runes) {
      final ch = String.fromCharCode(rune);
      if (ch == '"' || _regexMetachars.contains(ch)) {
        buffer.write('\\$ch');
      } else {
        buffer.write(ch);
      }
    }
    return buffer.toString();
  }

  // rico-api يوفر ترتيباً حقيقياً (سعر/تقييم فعليين) لكن تغطيته محدودة حالياً
  // بالمناطق التي زُوّدت ببيانات جوجل — Overpass يبقى المصدر الاحتياطي دوماً
  // لأنه يغطي كل السعودية. لا معنى لطلب أرخص/أعلى تقييماً بعلامة تجارية محددة
  // (brandHint) لأن /search لا يفلتر بالاسم بعد، فنتجاهله في هذه الحالة.
  static const String _ricoApiBaseUrl = 'https://rico-api.rico-app-maher.workers.dev';

  Future<List<PlaceResult>> search({
    required double userLat,
    required double userLng,
    required List<OsmTag> tags,
    bool cheapest = false,
    bool openNow = false,
    bool bestRated = false,
    String? brandHint,
    String? categorySlug,
    int radiusMeters = 3000,
  }) async {
    if ((cheapest || bestRated) && categorySlug != null && brandHint == null) {
      final ranked = await _searchRicoApi(
        userLat: userLat,
        userLng: userLng,
        categorySlug: categorySlug,
        rank: bestRated ? 'best_rated' : 'cheapest',
        radiusMeters: radiusMeters,
      );
      if (ranked != null) return ranked;
    }

    var results = await _searchOnce(
      userLat: userLat,
      userLng: userLng,
      tags: tags,
      radiusMeters: radiusMeters,
      openNow: openNow,
      brandHint: brandHint,
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
        openNow: openNow,
        brandHint: brandHint,
      );
    }

    return results;
  }

  /// يحاول جلب ترتيب حقيقي (أرخص/أعلى تقييماً) من rico-api. يرجع null إذا
  /// فشل الاتصال، أو لم تتوفر بيانات كافية للترتيب المطلوب فعلياً، أو لم توجد
  /// نتائج — في كل هذه الحالات يسقط المستدعي إلى Overpass تلقائياً.
  Future<List<PlaceResult>?> _searchRicoApi({
    required double userLat,
    required double userLng,
    required String categorySlug,
    required String rank,
    required int radiusMeters,
  }) async {
    try {
      final uri = Uri.parse('$_ricoApiBaseUrl/search').replace(queryParameters: {
        'lat': '$userLat',
        'lng': '$userLng',
        'radius': '$radiusMeters',
        'categorySlug': categorySlug,
        'rank': rank,
      });

      final response = await http.get(uri).timeout(const Duration(seconds: 6));
      if (response.statusCode != 200) return null;

      final data = jsonDecode(utf8.decode(response.bodyBytes)) as Map<String, dynamic>;
      final dataAvailable = rank == 'cheapest'
          ? data['priceDataAvailable'] == true
          : data['ratingDataAvailable'] == true;
      if (!dataAvailable) return null;

      final places = (data['places'] as List?) ?? [];
      if (places.isEmpty) return null;

      return places
          .map((p) => PlaceResult.fromRicoApiJson(p as Map<String, dynamic>))
          .toList();
    } catch (_) {
      return null;
    }
  }

  Future<List<PlaceResult>> _searchOnce({
    required double userLat,
    required double userLng,
    required List<OsmTag> tags,
    required int radiusMeters,
    bool openNow = false,
    String? brandHint,
  }) async {
    final nameFilter =
        brandHint != null && _sanitizeBrandHint(brandHint) != null
            ? '["name"~"${_sanitizeBrandHint(brandHint)}",i]'
            : '';

    final filters = tags
        .map((t) => '''
  node["${t.key}"="${t.value}"]$nameFilter(around:$radiusMeters,$userLat,$userLng);
  way["${t.key}"="${t.value}"]$nameFilter(around:$radiusMeters,$userLat,$userLng);''')
        .join('\n');

    final query = '''
[out:json][timeout:25];
(
$filters
);
out center tags;
''';

    Exception? lastError;
    var anyConnectionFailure = false;

    for (final endpoint in _endpoints) {
      http.Response? response;

      // إعادة محاولة واحدة على نفس المرآة: فشل الاتصال قد يكون بسبب استيقاظ
      // شبكة الجهاز بعد فترة خمول، لا مشكلة فعلية بالخادم — لكن محاولات كثيرة
      // بمهلة طويلة على مرآة معطّلة فعلاً تُبطّئ كل الطلب بلا فائدة
      for (var attempt = 0; attempt < 2; attempt++) {
        try {
          response = await http
              .post(
                Uri.parse(endpoint),
                body: {'data': query},
              )
              .timeout(const Duration(seconds: 10));

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
        anyConnectionFailure = true;
        lastError = PlacesException('تعذر الوصول لخدمة الأماكن حالياً، جاري تجربة خادم بديل...');
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
        if (openNow) {
          // لا نستبعد المغلق/غير المؤكد نهائياً (بيانات opening_hours متفرقة)،
          // فقط نقدّم المفتوح المؤكد أولاً ثم نرتب كل مجموعة حسب الأقرب
          results.sort((a, b) {
            final aRank = a.isOpenNow == true ? 0 : (a.isOpenNow == null ? 1 : 2);
            final bRank = b.isOpenNow == true ? 0 : (b.isOpenNow == null ? 1 : 2);
            if (aRank != bRank) return aRank.compareTo(bRank);
            return (a.distanceMeters ?? 0).compareTo(b.distanceMeters ?? 0);
          });
        } else {
          results.sort((a, b) =>
              (a.distanceMeters ?? 0).compareTo(b.distanceMeters ?? 0));
        }

        return results.take(8).toList();
      } catch (e) {
        lastError = PlacesException('تعذر الوصول لخدمة الأماكن حالياً، جاري تجربة خادم بديل...');
        continue;
      }
    }

    // إذا فشل الاتصال بكل المرايا (لا رد أصلاً)، الاحتمال الأكبر مشكلة شبكة
    // مؤقتة بالجهاز (خصوصاً بعد فترة خمول)، وليس تعطّل كل الخوادم الأربعة فعلاً
    if (anyConnectionFailure) {
      throw PlacesException('تعذر الاتصال بالإنترنت، تحقق من اتصالك وحاول مرة أخرى.');
    }

    throw lastError ?? PlacesException('تعذر الاتصال بخدمة الأماكن حالياً.');
  }
}
