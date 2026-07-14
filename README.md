# 🟢 ريكو (Rico) — مساعد ذكي يقترح لك أقرب الأماكن (مجاني 100%)

تطبيق Flutter (Demo) يمثل شات ذكي يحدد موقعك في السعودية، ولما تطلب منه
"أقرب مطعم" أو "أقرب كافيه" أو أي نوع محل تجاري، يقترح لك أفضل الخيارات
باستخدام **OpenStreetMap (Overpass API)** — مصدر بيانات مجاني بالكامل،
بدون مفتاح API، بدون بطاقة ائتمان، بدون حدود فوترة.

## 🧠 كيف يعمل (منطق الديمو)

1. المستخدم يكتب طلب بالعربي مثل: "أقرب مطعم" أو "أرخص كافيه قريب مني"
2. `IntentService` يحلل الجملة ويحدد نوع المكان (مطعم/كافيه/صيدلية/بنك...)
   عبر مطابقة كلمات مفتاحية، ويحوّله لوسم OpenStreetMap (مثل `amenity=restaurant`)
3. `LocationService` يجيب موقع المستخدم الحالي (GPS)
4. `PlacesService` يستدعي **Overpass API** (مجاني تماماً) للبحث عن كل نقاط
   الاهتمام المطابقة حول موقعه ضمن نطاق معيّن
5. النتائج تُرتب حسب الأقرب مسافة وتُعرض كبطاقات داخل الشات (اسم، عنوان،
   مسافة، ساعات العمل، هاتف إن وُجد، رابط خرائط جوجل)

## ⚠️ صراحةً عن حدود الحل المجاني

- **لا يوجد "عروض" أو أسعار حقيقية**: لا Google Places ولا OpenStreetMap
  يوفران بيانات كوبونات/خصومات فعلية. OpenStreetMap لا يحتوي عادة على
  تقييم (rating) أو مستوى سعر (price_level) موثوق، لذلك طلب "أرخص" في
  هذا الديمو يُعامل كطلب "الأقرب" مع توضيح صريح للمستخدم داخل الرد.
- **جودة البيانات تعتمد على مساهمي OpenStreetMap**: في المدن الكبيرة
  (الرياض، جدة، الدمام) التغطية جيدة جداً، لكنها قد تكون أقل تفصيلاً من
  Google في بعض الأحياء أو المدن الصغيرة.
- **الخادم العام مشترك**: نستخدم مرآة مجانية غير محدودة
  (`overpass.kumi.systems`) كخيار أساسي، مع خادم OSM الرسمي كبديل عند الفشل.
  للاستخدام الإنتاجي الثقيل مستقبلاً، الأفضل استضافة Overpass بنفسك.

## 🛠️ خطوات التشغيل

### 1. المتطلبات
- Flutter SDK مثبت فقط (`flutter --version` للتأكد)
- **لا حاجة لأي مفتاح API** ✅

### 2. توليد ملفات المنصات (Android/iOS)
```bash
flutter create .
```

### 3. إضافة صلاحية الموقع

**Android** — في `android/app/src/main/AndroidManifest.xml` أضف داخل `<manifest>`:
```xml
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>
<uses-permission android:name="android.permission.INTERNET"/>
```

**iOS** — في `ios/Runner/Info.plist` أضف:
```xml
<key>NSLocationWhenInUseUsageDescription</key>
<string>يحتاج ريكو موقعك ليقترح عليك أقرب الأماكن</string>
```

### 4. التثبيت والتشغيل
```bash
flutter pub get
flutter run
```

## 📂 هيكل المشروع
```
lib/
  models/
    chat_message.dart        # موديل رسالة الشات
    place_result.dart        # موديل نتيجة المكان (من OpenStreetMap)
  services/
    intent_service.dart      # تحليل نية المستخدم → وسم OSM
    location_service.dart    # جلب موقع المستخدم
    places_service.dart      # استدعاء Overpass API (مجاني)
  screens/
    chat_screen.dart         # شاشة الشات الرئيسية
  widgets/
    message_bubble.dart      # فقاعة الرسالة
    place_card.dart          # بطاقة عرض المكان
  main.dart                  # نقطة الدخول
```

## 🚀 خطوات منطقية بعد الديمو
- ربط تحليل النية بـ LLM حقيقي بدل الكلمات المفتاحية (فهم أي صياغة عربية)
- لو احتجت بيانات أدق مستقبلاً وقبلت بالدفع: يمكن الانتقال لـ Google Places
  API (New) أو Foursquare Places API كمصدر مكمّل، مع الاحتفاظ بـ OpenStreetMap
  كخيار افتراضي مجاني
- لإضافة "عروض حقيقية": تحتاج شراكات مباشرة مع المحلات لعرض عروضهم الفعلية،
  فلا مصدر مجاني عام يوفر هذا النوع من البيانات
- استضافة خادم Overpass خاص بك عند نمو الاستخدام (متوفر مفتوح المصدر)
- إضافة خريطة تفاعلية داخل التطبيق (`google_maps_flutter` أو `flutter_map`
  مع طبقات OpenStreetMap المجانية) بدل فتح خرائط جوجل خارجياً
- Caching محلي لنتائج البحث لتقليل الطلبات على الخادم المشترك
