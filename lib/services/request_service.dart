import 'dart:convert';
import 'package:http/http.dart' as http;

class RequestException implements Exception {
  final String message;
  RequestException(this.message);
  @override
  String toString() => message;
}

/// يرسل طلب تواصل حقيقي (اهتمام بمنتج أو عرض عند نشاط تجاري معيّن) إلى
/// rico-backend (POST /requests) — يظهر لصاحب النشاط في لوحته ليتواصل مع
/// العميل مباشرة. لا نظام دفع أو توصيل، مجرد طلب/اهتمام (lead).
class RequestService {
  static const String _baseUrl = 'http://localhost:3000';

  Future<void> submitRequest({
    required String businessId,
    required String customerName,
    required String customerPhone,
    required String itemType,
    required String itemId,
  }) async {
    http.Response response;
    try {
      response = await http
          .post(
            Uri.parse('$_baseUrl/requests'),
            headers: {'Content-Type': 'application/json'},
            body: jsonEncode({
              'businessId': businessId,
              'customerName': customerName,
              'customerPhone': customerPhone,
              'itemType': itemType,
              'itemId': itemId,
            }),
          )
          .timeout(const Duration(seconds: 6));
    } catch (_) {
      throw RequestException('ما قدرت أرسل طلبك حالياً، تحقق من اتصالك وحاول مرة ثانية.');
    }

    if (response.statusCode != 200 && response.statusCode != 201) {
      throw RequestException('ما قدرت أرسل طلبك حالياً، حاول مرة ثانية.');
    }
  }
}
