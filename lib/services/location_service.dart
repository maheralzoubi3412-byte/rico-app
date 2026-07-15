import 'package:geolocator/geolocator.dart';

/// نوع مشكلة الموقع، يستخدم لتحديد ما إذا كان يجدر عرض زر "فتح الإعدادات"
/// وأي إعدادات يفتح (إعدادات الموقع نفسه أو إعدادات إذن التطبيق).
enum LocationErrorType { serviceDisabled, permissionDenied, permissionDeniedForever, unknown }

class LocationException implements Exception {
  final String message;
  final LocationErrorType type;
  LocationException(this.message, {this.type = LocationErrorType.unknown});
  @override
  String toString() => message;
}

class LocationService {
  /// يطلب صلاحية الموقع (إن لم تُمنح) ثم يرجع الموقع الحالي للمستخدم
  Future<Position> getCurrentLocation() async {
    final serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) {
      throw LocationException(
        'خدمة الموقع غير مفعّلة على جهازك. فعّلها من الإعدادات ثم حاول مجدداً.',
        type: LocationErrorType.serviceDisabled,
      );
    }

    LocationPermission permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
      if (permission == LocationPermission.denied) {
        throw LocationException(
          'أحتاج إذن الوصول لموقعك لأقترح عليك أقرب الأماكن 📍',
          type: LocationErrorType.permissionDenied,
        );
      }
    }

    if (permission == LocationPermission.deniedForever) {
      throw LocationException(
        'تم رفض إذن الموقع بشكل دائم. فعّله من إعدادات التطبيق حتى أقدر أساعدك.',
        type: LocationErrorType.permissionDeniedForever,
      );
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
