import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/place_result.dart';

/// يحفظ الأماكن المفضّلة محلياً على الجهاز (بدون خادم أو حساب مستخدم).
class FavoritesService {
  static const _storageKey = 'favorite_places';

  Future<List<PlaceResult>> getAll() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getStringList(_storageKey) ?? [];
    return raw
        .map((s) => PlaceResult.fromJson(jsonDecode(s) as Map<String, dynamic>))
        .toList();
  }

  Future<bool> isFavorite(String osmId) async {
    final all = await getAll();
    return all.any((p) => p.osmId == osmId);
  }

  /// يبدّل حالة الحفظ: يضيف المكان إذا لم يكن محفوظاً، أو يحذفه إذا كان محفوظاً.
  /// يرجع الحالة الجديدة (true = محفوظ الآن).
  Future<bool> toggle(PlaceResult place) async {
    final prefs = await SharedPreferences.getInstance();
    final all = await getAll();
    final alreadySaved = all.any((p) => p.osmId == place.osmId);

    final updated = alreadySaved
        ? all.where((p) => p.osmId != place.osmId).toList()
        : [...all, place];

    await prefs.setStringList(
      _storageKey,
      updated.map((p) => jsonEncode(p.toJson())).toList(),
    );

    return !alreadySaved;
  }

  Future<void> remove(String osmId) async {
    final prefs = await SharedPreferences.getInstance();
    final all = await getAll();
    final updated = all.where((p) => p.osmId != osmId).toList();
    await prefs.setStringList(
      _storageKey,
      updated.map((p) => jsonEncode(p.toJson())).toList(),
    );
  }
}
