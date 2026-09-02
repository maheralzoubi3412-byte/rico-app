import 'dart:convert';
import 'package:http/http.dart' as http;
import '../models/place_result.dart';

class PlacesException implements Exception {
  final String message;
  PlacesException(this.message);
  @override
  String toString() => message;
}

/// خدمة البحث عن الأماكن — تستدعي rico-backend (GET /search)، والذي يبحث
/// أولاً بين نشاطاتنا الحقيقية (source == 'rico') ثم يكمل النقص عبر Google
/// Places إذا احتاج الأمر (source == 'google' حينها). لا بحث مباشر من
/// التطبيق لأي خدمة خارجية — المفتاح يبقى على الخادم فقط.
class PlacesService {
  // للتجربة المحلية بدّلها لـ http://localhost:3000 (iOS Simulator/سطح
  // المكتب) أو http://10.0.2.2:3000 (Android Emulator).
  static const String _ricoApiBaseUrl = 'https://app.rico-go.com';

  /// [openNow] و[brandHint] غير مدعومين حالياً من الخادم (يحتاجان Google Text
  /// Search بدل Nearby Search) — مقبولان هنا لتفادي تعديل نداءات الاستدعاء،
  /// لكنهما بلا أثر فعلي إلى أن تُضاف تلك القدرة.
  Future<List<PlaceResult>> search({
    required double userLat,
    required double userLng,
    bool cheapest = false,
    bool openNow = false,
    bool bestRated = false,
    String? brandHint,
    String? categorySlug,
    int radiusMeters = 3000,
  }) async {
    // فئة حرة (customTag/"other" بلا slug ثابت) لا مقابل لها بعد في تصنيف
    // Google الثابت (GOOGLE_TYPE_BY_CATEGORY) ولا في قاعدتنا المصنّفة بـslug.
    if (categorySlug == null) return [];

    final uri = Uri.parse('$_ricoApiBaseUrl/search').replace(queryParameters: {
      'lat': '$userLat',
      'lng': '$userLng',
      'radius': '$radiusMeters',
      'categorySlug': categorySlug,
      'rank': bestRated ? 'best_rated' : (cheapest ? 'cheapest' : 'nearest'),
    });

    http.Response response;
    try {
      response = await http.get(uri).timeout(const Duration(seconds: 8));
    } catch (_) {
      throw PlacesException('ما قدرت أتصل بالإنترنت، تأكد من اتصالك وحاول مرة كمان.');
    }

    if (response.statusCode != 200) {
      throw PlacesException('ما قدرت أوصل لخدمة الأماكن حالياً، حاول مرة كمان.');
    }

    final data = jsonDecode(utf8.decode(response.bodyBytes)) as Map<String, dynamic>;
    final places = (data['places'] as List?) ?? [];
    return places.map((p) => PlaceResult.fromRicoApiJson(p as Map<String, dynamic>)).toList();
  }
}
