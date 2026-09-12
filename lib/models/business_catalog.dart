import 'currency.dart';

/// منتج ضمن قائمة نشاط تجاري معيّن، كما يُرجعه GET /places/:id/catalog.
class CatalogProduct {
  final String id;
  final String name;
  final String? category;
  final double price;
  final double finalPrice;
  final String currency;

  CatalogProduct({
    required this.id,
    required this.name,
    this.category,
    required this.price,
    required this.finalPrice,
    this.currency = kDefaultCurrency,
  });

  factory CatalogProduct.fromJson(Map<String, dynamic> json) {
    return CatalogProduct(
      id: json['id'] as String,
      name: json['name'] as String,
      category: json['category'] as String?,
      price: (json['price'] as num).toDouble(),
      finalPrice: (json['finalPrice'] as num).toDouble(),
      currency: json['currency'] as String? ?? kDefaultCurrency,
    );
  }

  bool get hasDiscount => finalPrice < price;

  /// السعر بعد الخصم مع اسم العملة — الصياغة الوحيدة المستخدمة في الواجهة،
  /// حتى لا يتكرر رمز العملة مكتوباً بخط اليد في كل مكان يعرض سعراً.
  String get priceLabel => '${finalPrice.toStringAsFixed(0)} ${currencyLabel(currency)}';

  /// السعر قبل الخصم، بلا عملة — يظهر مباشرة بعد priceLabel في نفس السطر.
  String get originalPriceLabel => price.toStringAsFixed(0);
}

/// عرض ضمن قائمة نشاط تجاري معيّن (وليس عروض قريبة عامة كما في GET /deals).
class CatalogDeal {
  final String id;
  final String titleAr;
  final String? descriptionAr;
  final String dealType; // percent | fixed | bogo | free_item | bundle
  final double? value;
  final String currency;
  final String? promoCode;

  CatalogDeal({
    required this.id,
    required this.titleAr,
    this.descriptionAr,
    required this.dealType,
    this.value,
    this.currency = kDefaultCurrency,
    this.promoCode,
  });

  factory CatalogDeal.fromJson(Map<String, dynamic> json) {
    return CatalogDeal(
      id: json['id'] as String,
      titleAr: json['titleAr'] as String,
      descriptionAr: json['descriptionAr'] as String?,
      dealType: json['dealType'] as String,
      value: (json['value'] as num?)?.toDouble(),
      currency: json['currency'] as String? ?? kDefaultCurrency,
      promoCode: json['promoCode'] as String?,
    );
  }

  /// نفس صياغة Deal.typeLabel — موحّدة عبر التطبيق.
  String get typeLabel {
    switch (dealType) {
      case 'percent':
        return value != null ? 'خصم ${value!.toStringAsFixed(0)}٪' : 'خصم';
      case 'fixed':
        return value != null
            ? 'خصم ${value!.toStringAsFixed(0)} ${currencyLabel(currency)}'
            : 'خصم';
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
