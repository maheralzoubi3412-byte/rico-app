/// منتج ضمن قائمة نشاط تجاري معيّن، كما يُرجعه GET /places/:id/catalog.
class CatalogProduct {
  final String id;
  final String name;
  final String? category;
  final double price;
  final double finalPrice;

  CatalogProduct({
    required this.id,
    required this.name,
    this.category,
    required this.price,
    required this.finalPrice,
  });

  factory CatalogProduct.fromJson(Map<String, dynamic> json) {
    return CatalogProduct(
      id: json['id'] as String,
      name: json['name'] as String,
      category: json['category'] as String?,
      price: (json['price'] as num).toDouble(),
      finalPrice: (json['finalPrice'] as num).toDouble(),
    );
  }

  bool get hasDiscount => finalPrice < price;
}

/// عرض ضمن قائمة نشاط تجاري معيّن (وليس عروض قريبة عامة كما في GET /deals).
class CatalogDeal {
  final String id;
  final String titleAr;
  final String? descriptionAr;
  final String dealType; // percent | fixed | bogo | free_item | bundle
  final double? value;
  final String? promoCode;

  CatalogDeal({
    required this.id,
    required this.titleAr,
    this.descriptionAr,
    required this.dealType,
    this.value,
    this.promoCode,
  });

  factory CatalogDeal.fromJson(Map<String, dynamic> json) {
    return CatalogDeal(
      id: json['id'] as String,
      titleAr: json['titleAr'] as String,
      descriptionAr: json['descriptionAr'] as String?,
      dealType: json['dealType'] as String,
      value: (json['value'] as num?)?.toDouble(),
      promoCode: json['promoCode'] as String?,
    );
  }

  /// نفس صياغة Deal.typeLabel — موحّدة عبر التطبيق.
  String get typeLabel {
    switch (dealType) {
      case 'percent':
        return value != null ? 'خصم ${value!.toStringAsFixed(0)}٪' : 'خصم';
      case 'fixed':
        return value != null ? 'خصم ${value!.toStringAsFixed(0)} ر.س' : 'خصم';
      case 'bogo':
        return 'اشتري واحد واحصل على الثاني مجاناً';
      case 'free_item':
        return 'عنصر مجاني';
      case 'bundle':
        return 'عرض باقة';
      default:
        return 'عرض';
    }
  }
}

/// قائمة منتجات وعروض نشاط تجاري واحد — لعرضها داخل الدردشة عند اختيار
/// نتيجة بحث حقيقية من قاعدة ريكو (source == 'rico').
class BusinessCatalog {
  final String businessId;
  final String businessName;
  final List<CatalogProduct> products;
  final List<CatalogDeal> deals;

  BusinessCatalog({
    required this.businessId,
    required this.businessName,
    required this.products,
    required this.deals,
  });

  factory BusinessCatalog.fromJson(Map<String, dynamic> json) {
    return BusinessCatalog(
      businessId: json['businessId'] as String,
      businessName: json['businessName'] as String,
      products: (json['products'] as List? ?? [])
          .map((p) => CatalogProduct.fromJson(p as Map<String, dynamic>))
          .toList(),
      deals: (json['deals'] as List? ?? [])
          .map((d) => CatalogDeal.fromJson(d as Map<String, dynamic>))
          .toList(),
    );
  }

  bool get isEmpty => products.isEmpty && deals.isEmpty;
}
