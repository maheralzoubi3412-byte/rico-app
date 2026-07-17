import 'dart:convert';
import 'package:http/http.dart' as http;
import '../models/deal.dart';

class DealsException implements Exception {
  final String message;
  DealsException(this.message);
  @override
  String toString() => message;
}

/// يجلب العروض/الخصومات القريبة من rico-api (خادم Cloudflare Worker مخصص،
/// انظر server/rico-api).
class DealsService {
  // TODO: حدّث هذا الرابط بعد نشر rico-api عبر `wrangler deploy`
  // (server/rico-api) — راجع server/rico-api/wrangler.toml لاسم الـ Worker.
  static const String _baseUrl = 'https://rico-api.rico-app-maher.workers.dev';

  Future<List<Deal>> fetchNearby({
    required double lat,
    required double lng,
    int radiusMeters = 3000,
  }) async {
    final uri = Uri.parse('$_baseUrl/deals').replace(queryParameters: {
      'lat': '$lat',
      'lng': '$lng',
      'radius': '$radiusMeters',
    });

    http.Response response;
    try {
      response = await http.get(uri).timeout(const Duration(seconds: 6));
    } catch (_) {
      throw DealsException('تعذر الاتصال بخدمة العروض حالياً، حاول مرة أخرى.');
    }

    if (response.statusCode != 200) {
      throw DealsException('تعذر جلب العروض حالياً (رمز ${response.statusCode}).');
    }

    try {
      final data = jsonDecode(utf8.decode(response.bodyBytes)) as Map<String, dynamic>;
      final deals = (data['deals'] as List?) ?? [];
      return deals
          .map((d) => Deal.fromJson(d as Map<String, dynamic>))
          .toList();
    } catch (_) {
      throw DealsException('تعذر قراءة بيانات العروض حالياً.');
    }
  }
}
