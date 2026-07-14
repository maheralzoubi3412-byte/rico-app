import 'package:geolocator/geolocator.dart';

class LocationException implements Exception {
  final String message;
  LocationException(this.message);
  @override
  String toString() => message;
}

class LocationService {
  /// يطلب صلاحية الموقع (إن لم تُمنح) ثم يرجع الموقع الحالي للمستخدم
  Future<Position> getCurrentLocation() async {
    final serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) {
      throw LocationException(
          'خدمة الموقع غير مفعّلة على جهازك. فعّلها من الإعدادات ثم حاول مجدداً.');
    }

    LocationPermission permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
      if (permission == LocationPermission.denied) {
        throw LocationException('أحتاج إذن الوصول لموقعك لأقترح عليك أقرب الأماكن 📍');
      }
    }

    if (permission == LocationPermission.deniedForever) {
      throw LocationException(
          'تم رفض إذن الموقع بشكل دائم. فعّله من إعدادات التطبيق حتى أقدر أساعدك.');
    }

    return await Geolocator.getCurrentPosition(
      desiredAccuracy: LocationAccuracy.high,
    );
  }

  double distanceInMeters(
      double startLat, double startLng, double endLat, double endLng) {
    return Geolocator.distanceBetween(startLat, startLng, endLat, endLng);
  }
}
