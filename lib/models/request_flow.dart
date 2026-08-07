import 'business_catalog.dart';

enum RequestFlowStage { browsing, confirming, submitting, submitted }

/// حالة تدفّق "تصفّح المنتجات/العروض ثم تأكيد طلب" داخل رسالة دردشة واحدة —
/// بديل حقيقي لتدفّق الطلب التجريبي (DemoOrder) الذي كان لا يتصل بأي خادم.
class RequestFlow {
  final BusinessCatalog catalog;
  final RequestFlowStage stage;
  final String? selectedItemType; // 'product' | 'deal'
  final String? selectedItemId;
  final String? selectedItemLabel;
  final String? selectedItemDetail;
  final String? customerName;
  final String? customerPhone;
  final String? errorMessage;

  RequestFlow({
    required this.catalog,
    this.stage = RequestFlowStage.browsing,
    this.selectedItemType,
    this.selectedItemId,
    this.selectedItemLabel,
    this.selectedItemDetail,
    this.customerName,
    this.customerPhone,
    this.errorMessage,
  });

  RequestFlow copyWith({
    RequestFlowStage? stage,
    String? selectedItemType,
    String? selectedItemId,
    String? selectedItemLabel,
    String? selectedItemDetail,
    String? customerName,
    String? customerPhone,
    String? errorMessage,
    bool clearError = false,
    bool clearSelection = false,
  }) {
    return RequestFlow(
      catalog: catalog,
      stage: stage ?? this.stage,
      selectedItemType: clearSelection ? null : (selectedItemType ?? this.selectedItemType),
      selectedItemId: clearSelection ? null : (selectedItemId ?? this.selectedItemId),
      selectedItemLabel: clearSelection ? null : (selectedItemLabel ?? this.selectedItemLabel),
      selectedItemDetail: clearSelection ? null : (selectedItemDetail ?? this.selectedItemDetail),
      customerName: customerName ?? this.customerName,
      customerPhone: customerPhone ?? this.customerPhone,
      errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
    );
  }
}
