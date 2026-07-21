// Intentional permanent demo — not a stub awaiting a real ordering backend.
// Rico has no ordering/payment/delivery system; this exists purely to show
// the confirm-and-pay + tracking stages of the RICO GO design visually.
// Everything except [placeName] is fabricated and deterministic (no
// randomization, no persistence) — see the "عرض تجريبي" badge on the cards
// that render this.

enum DemoOrderStage { reviewing, tracking }

class DemoOrderItem {
  final String nameAr;
  final double priceSar;
  final bool addedByRico;

  const DemoOrderItem({
    required this.nameAr,
    required this.priceSar,
    this.addedByRico = false,
  });
}

class DemoOrder {
  final String placeName;
  final List<DemoOrderItem> items;
  final String savingsNoteAr;
  final String orderNumber;
  final String driverName;
  final int etaMinutes;
  final int deliveryStep; // 0=confirm 1=prepare 2=pickup 3=deliver
  final DemoOrderStage stage;

  /// رسالة استباقية تظهر مع بطاقة التتبّع — نص تجريبي ثابت (كبقية حقول هذا
  /// الصف)، وليس تنبيهاً حقيقياً من مطعم فعلي.
  final String proactiveNoteAr;

  const DemoOrder({
    required this.placeName,
    required this.items,
    required this.savingsNoteAr,
    required this.orderNumber,
    required this.driverName,
    required this.etaMinutes,
    required this.deliveryStep,
    required this.stage,
    required this.proactiveNoteAr,
  });

  /// يبني عرض طلب تجريبي ثابت (لا عشوائية) لمكان حقيقي — كل الأسعار والعناصر
  /// افتراضية بحتة لأن [PlaceResult] لا يوفر سعر فعلي، فقط priceLevel تقديري.
  factory DemoOrder.forPlace(String placeName) {
    return DemoOrder(
      placeName: placeName,
      items: [
        DemoOrderItem(nameAr: 'وجبة رئيسية من $placeName', priceSar: 165),
        const DemoOrderItem(nameAr: 'سلطة إضافية × 2', priceSar: 16, addedByRico: true),
      ],
      savingsNoteAr: 'وفّرت 19 ر.س من ميزانيتك 🎯',
      orderNumber: 'R-2841',
      driverName: 'أبو فهد',
      etaMinutes: 12,
      deliveryStep: 2,
      stage: DemoOrderStage.reviewing,
      proactiveNoteAr: 'المطعم نسي يضيف ملاحظة «بدون بصل» — كلمتهم وتأكّدت قبل التحضير ✓',
    );
  }

  double get totalSar => items.fold(0, (sum, i) => sum + i.priceSar);

  DemoOrder copyWith({
    int? deliveryStep,
    DemoOrderStage? stage,
  }) {
    return DemoOrder(
      placeName: placeName,
      items: items,
      savingsNoteAr: savingsNoteAr,
      orderNumber: orderNumber,
      driverName: driverName,
      etaMinutes: etaMinutes,
      deliveryStep: deliveryStep ?? this.deliveryStep,
      stage: stage ?? this.stage,
      proactiveNoteAr: proactiveNoteAr,
    );
  }
}
