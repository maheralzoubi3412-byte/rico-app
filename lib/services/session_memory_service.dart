import 'package:shared_preferences/shared_preferences.dart';

/// موقع محفوظ محلياً (مثل "بيتي")
class SavedLocation {
  final double lat;
  final double lng;
  SavedLocation(this.lat, this.lng);
}

/// يحفظ تفضيلات خفيفة عبر الجلسات محلياً على الجهاز (بدون خادم أو حساب):
/// موقع "بيتي" وآخر فئة بحث ناجحة، لدعم طلبات مثل "قريب من بيتي" أو
/// استكمال طلب سابق بدون كلمة فئة صريحة.
class SessionMemoryService {
  static const _homeLatKey = 'home_lat';
  static const _homeLngKey = 'home_lng';
  static const _lastCategoryKey = 'last_category_slug';

  Future<SavedLocation?> getHome() async {
    final prefs = await SharedPreferences.getInstance();
    final lat = prefs.getDouble(_homeLatKey);
    final lng = prefs.getDouble(_homeLngKey);
    if (lat == null || lng == null) return null;
    return SavedLocation(lat, lng);
  }

  Future<void> saveHome(double lat, double lng) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setDouble(_homeLatKey, lat);
    await prefs.setDouble(_homeLngKey, lng);
  }

  Future<String?> getLastCategorySlug() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_lastCategoryKey);
  }

  Future<void> saveLastCategorySlug(String slug) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_lastCategoryKey, slug);
  }
}
