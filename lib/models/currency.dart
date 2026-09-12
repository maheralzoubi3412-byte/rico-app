/// العملة الافتراضية لهذا الإصدار. الخادم يرسل العملة مع كل سعر، لكن
/// السجلات التي كُتبت قبل إضافة الحقل ترجع بلا عملة، فتُقرأ على أنها دينار.
const String kDefaultCurrency = 'JOD';

const Map<String, String> _currencyLabels = {
  'JOD': 'دينار',
  'SAR': 'ريال',
};

/// اسم العملة بالعربي — رمز ISO خام ("JOD") داخل جملة عربية يُقرأ كأنه خطأ،
/// ورمز العملة المفرد (﷼ / د.ا) يلتصق بالأرقام في أحجام النص الصغيرة. أي
/// عملة غير معروفة ترجع كما هي بدل أن نخترع لها اسماً.
String currencyLabel(String? code) {
  final resolved = (code == null || code.isEmpty) ? kDefaultCurrency : code;
  return _currencyLabels[resolved] ?? resolved;
}
