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
  final int? priceLevel; // 1-4، من rico-api فقط (Overpass لا يوفرها)
  final double? rating; // 0-5، من rico-api فقط
  final int? ratingCount;

  /// حالة الفتح كما جاءت من الخادم (مصدرها Google) — أدق من تحليل نص
  /// المواعيد، وnull لما ما يعرفها أحد. انظر [isOpenNow].
  final bool? serverOpenNow;

  /// 'rico' إذا وصل نشاطاً حقيقياً من قاعدتنا (قابل لعرض كتالوج/طلب فعلي)،
  /// أو 'google' إذا وصل من Google Places كنتيجة تكميلية بلا سجل نشاط تجاري
  /// عندنا. يُستخدم لتفادي إرسال أحداث تتبّع أو تفعيل كتالوج/طلب بمعرّفات
  /// لا تقابل نشاطاً تجارياً حقيقياً.
  final String source;

  PlaceResult({
    required this.osmId,
    required this.name,
    required this.address,
    required this.lat,
    required this.lng,
    this.phone,
    this.openingHours,
    this.distanceMeters,
    this.priceLevel,
    this.rating,
    this.ratingCount,
    this.serverOpenNow,
    this.source = 'google',
  });

  /// يبني عنصر مكان من استجابة rico-api (GET /search) — قد تحتوي بيانات سعر
  /// وتقييم حقيقية من قاعدتنا أو من Google Places حسب source.
  factory PlaceResult.fromRicoApiJson(Map<String, dynamic> json) {
    return PlaceResult(
      osmId: json['id'] as String,
      name: (json['nameAr'] ?? json['name']) as String,
      address: (json['address'] as String?) ?? '',
      lat: (json['lat'] as num).toDouble(),
      lng: (json['lng'] as num).toDouble(),
      phone: json['phone'] as String?,
      openingHours: json['openingHours'] as String?,
      distanceMeters: (json['distanceMeters'] as num?)?.toDouble(),
      priceLevel: json['priceLevel'] as int?,
      rating: (json['rating'] as num?)?.toDouble(),
      ratingCount: json['ratingCount'] as int?,
      serverOpenNow: json['openNow'] as bool?,
      source: (json['source'] as String?) ?? 'rico',
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
      priceLevel: priceLevel,
      rating: rating,
      ratingCount: ratingCount,
      serverOpenNow: serverOpenNow,
      source: source,
    );
  }

  /// null = ما نقدر نتأكد من حالة الفتح الحين.
  ///
  /// حكم Google (يوصل من الخادم في [serverOpenNow]) مقدَّم على تحليل نص
  /// المواعيد عندنا: هو مبني على بيانات المكان نفسها، أما النص فقد يكون بصيغة
  /// ما يفهمها المحلل أصلاً.
  bool? get isOpenNow => serverOpenNow ?? OpeningHours.isOpenNow(openingHours, DateTime.now());

  String get distanceLabel {
    if (distanceMeters == null) return '';
    if (distanceMeters! < 1000) {
      return '${distanceMeters!.round()} م';
    }
    return '${(distanceMeters! / 1000).toStringAsFixed(1)} كم';
  }

  static const List<String> _priceLevelLabels = ['اقتصادي', 'متوسط', 'مرتفع', 'راقي'];

  /// وصف مستوى السعر بكلمة واحدة حسب المستوى (1-4)، أو null إن لم تتوفر
  /// بيانات سعر. الكلمة أوضح للمستخدم من تكرار رمز الريال، الذي يُصيّره خط
  /// النص كرباط "ريال" فيصير "ريال ريال" بلا معنى. القيمة مقصورة على المدى
  /// المتوقع تحصيناً من أي مستوى خارجه يصل من الخادم.
  String? get priceLevelLabel =>
      priceLevel == null ? null : _priceLevelLabels[priceLevel!.clamp(1, 4) - 1];

  String? get ratingLabel => rating == null ? null : '★ ${rating!.toStringAsFixed(1)}';

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
        'priceLevel': priceLevel,
        'rating': rating,
        'ratingCount': ratingCount,
        'openNow': serverOpenNow,
        'source': source,
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
      priceLevel: json['priceLevel'] as int?,
      rating: (json['rating'] as num?)?.toDouble(),
      ratingCount: json['ratingCount'] as int?,
      serverOpenNow: json['openNow'] as bool?,
      source: json['source'] as String? ?? 'google',
    );
  }
}
