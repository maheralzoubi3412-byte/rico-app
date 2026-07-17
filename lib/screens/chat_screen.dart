import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import '../models/chat_message.dart';
import '../services/deals_service.dart';
import '../services/intent_service.dart';
import '../services/llm_intent_service.dart';
import '../services/location_service.dart';
import '../services/places_service.dart';
import '../services/session_memory_service.dart';
import '../theme/app_theme.dart';
import '../widgets/message_bubble.dart';
import 'favorites_screen.dart';

class ChatScreen extends StatefulWidget {
  const ChatScreen({super.key});

  @override
  State<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends State<ChatScreen> {
  final List<ChatMessage> _messages = [];
  final TextEditingController _controller = TextEditingController();
  final ScrollController _scrollController = ScrollController();

  final LocationService _locationService = LocationService();
  final PlacesService _placesService = PlacesService();
  final SessionMemoryService _sessionMemory = SessionMemoryService();
  final DealsService _dealsService = DealsService();

  static final RegExp _homeMention = RegExp('بيتي|منزلي|البيت');

  Position? _cachedPosition;
  bool _sending = false;

  @override
  void initState() {
    super.initState();
    _messages.add(ChatMessage(
      text:
          'هلا وسهلا 👋 أنا ريكو، مساعدك الذكي في السعودية.\nاسألني مثلاً: "أقرب مطعم" أو "أرخص كافيه قريب" وبقترح لك أفضل الخيارات حسب موقعك.',
      sender: MessageSender.bot,
    ));
  }

  Future<Position> _getPosition() async {
    if (_cachedPosition != null) return _cachedPosition!;
    final pos = await _locationService.getCurrentLocation();
    _cachedPosition = pos;
    return pos;
  }

  /// يحدد نقطة انطلاق البحث: يستخدم موقع "بيتي" المحفوظ إذا ذكره المستخدم
  /// وكان محفوظاً، وإلا يستخدم GPS الحالي (ويعرض حفظه كـ"بيتي" لاحقاً إذا
  /// كانت هذه أول مرة يذكر فيها بيته ولا يوجد موقع محفوظ).
  Future<({double lat, double lng, bool offerSaveHome})> _resolveOrigin(String text) async {
    if (_homeMention.hasMatch(text)) {
      final home = await _sessionMemory.getHome();
      if (home != null) {
        return (lat: home.lat, lng: home.lng, offerSaveHome: false);
      }
      final position = await _getPosition();
      return (lat: position.latitude, lng: position.longitude, offerSaveHome: true);
    }
    final position = await _getPosition();
    return (lat: position.latitude, lng: position.longitude, offerSaveHome: false);
  }

  /// يبني آخر رسائل المحادثة كسياق للتصنيف عبر LLM، لدعم الاستكمالات مثل
  /// "بس أبعد شوي" بدل معاملة كل رسالة بمعزل عمّا سبقها.
  List<Map<String, String>> _buildHistory() {
    final relevant = _messages
        .where((m) => !m.isLoading && m.text.isNotEmpty)
        .toList();
    final recent = relevant.length > 6 ? relevant.sublist(relevant.length - 6) : relevant;
    return recent
        .map((m) => {
              'role': m.sender == MessageSender.user ? 'user' : 'assistant',
              'content': m.text,
            })
        .toList();
  }

  void _scrollToBottom() {
    Future.delayed(const Duration(milliseconds: 100), () {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut,
        );
      }
    });
  }

  /// يحل نية واحدة (مكان أو عروض) إلى رسالة رد جاهزة، مع عزل الأخطاء داخل
  /// النية نفسها (فشل نية واحدة من عدة نوايا في نفس الرسالة لا يوقف البقية).
  Future<ChatMessage> _resolveIntentMessage(
    QueryIntent intent,
    ({double lat, double lng, bool offerSaveHome}) origin,
    bool usedFallback,
  ) async {
    if (intent.kind == IntentKind.deals) {
      try {
        final deals = await _dealsService.fetchNearby(lat: origin.lat, lng: origin.lng);
        if (deals.isEmpty) {
          return ChatMessage(text: 'ما لقيت عروض قريبة منك حالياً 😕', sender: MessageSender.bot);
        }
        return ChatMessage(
          text: 'هذي أقرب العروض المتوفرة:',
          sender: MessageSender.bot,
          deals: deals,
        );
      } on DealsException catch (e) {
        return ChatMessage(text: e.message, sender: MessageSender.bot);
      } catch (_) {
        return ChatMessage(text: 'تعذر جلب العروض حالياً 😕', sender: MessageSender.bot);
      }
    }

    try {
      final places = await _placesService.search(
        userLat: origin.lat,
        userLng: origin.lng,
        tags: intent.tags,
        cheapest: intent.wantsCheapest,
        openNow: intent.wantsOpenNow,
        bestRated: intent.rank == RankMode.bestRated,
        brandHint: intent.brandHint,
        categorySlug: intent.slug,
      );

      if (places.isEmpty) {
        return ChatMessage(
          text: 'لم أجد ${intent.label} قريب منك حالياً 😕 جرّب توسيع نطاق البحث أو نوع مختلف.',
          sender: MessageSender.bot,
        );
      }

      // نميّز بين ترتيب حقيقي فعلاً (وصل من rico-api ومعه بيانات سعر/تقييم)
      // وبين رجوع Overpass الاحتياطي (بلا هذه البيانات) — حتى لا نوهم
      // المستخدم بترتيب حقيقي غير موجود فعلياً.
      var introText = 'هذي أقرب ${intent.label} لموقعك:';

      if (intent.wantsCheapest) {
        introText = places.first.priceLevel != null
            ? 'رتبت لك ${intent.label} من الأرخص للأغلى فعلياً حسب الأسعار:'
            : 'رتبت لك أقرب ${intent.label} (الأقرب غالباً أوفر بسبب توفير وقت ومشوار):';
      } else if (intent.rank == RankMode.bestRated) {
        introText = places.first.rating != null
            ? 'رتبت لك ${intent.label} من الأعلى تقييماً:'
            : 'هذي أقرب ${intent.label} لموقعك (ما توفرت بيانات تقييم كافية بعد):';
      }

      if (intent.wantsOpenNow) {
        final anyConfirmedOpen = places.any((p) => p.isOpenNow == true);
        introText = anyConfirmedOpen
            ? 'هذي أقرب ${intent.label} المفتوحة الآن:'
            : 'ما قدرت أتأكد من مواعيد الدوام بدقة، بس هذي أقرب ${intent.label}:';
      }

      if (usedFallback) {
        introText += '\n(ما قدرت أتأكد من نوع طلبك بدقة، صحح لي إذا ما كان قصدك 🙂)';
      }

      return ChatMessage(text: introText, sender: MessageSender.bot, places: places);
    } on PlacesException catch (e) {
      return ChatMessage(text: e.message, sender: MessageSender.bot);
    } catch (_) {
      return ChatMessage(text: 'حدث خطأ غير متوقع، حاول مرة أخرى 😕', sender: MessageSender.bot);
    }
  }

  Future<void> _handleSend() async {
    final text = _controller.text.trim();
    if (text.isEmpty || _sending) return;

    setState(() {
      _messages.add(ChatMessage(text: text, sender: MessageSender.user));
      _messages.add(ChatMessage(
          text: 'يبحث لك ريكو الآن...',
          sender: MessageSender.bot,
          isLoading: true));
      _sending = true;
    });
    _controller.clear();
    _scrollToBottom();

    try {
      final classification = await LlmIntentService.classify(text, history: _buildHistory());

      if (classification != null && classification.isOffTopic) {
        setState(() {
          _messages.removeLast(); // إزالة رسالة "يبحث..."
          _messages.add(ChatMessage(
            text: classification.reply ??
                'أنا ريكو، متخصص بمساعدتك تلقى أقرب مطعم أو كافيه أو صيدلية وغيرها 😊 جرّب تسألني مثلاً "أقرب مطعم".',
            sender: MessageSender.bot,
          ));
        });
        return;
      }

      final lastCategorySlug = await _sessionMemory.getLastCategorySlug();
      var intents = classification?.toQueryIntents() ?? const <QueryIntent>[];
      final usedFallback = classification == null || intents.isEmpty;
      if (intents.isEmpty) {
        intents = IntentService.parseMulti(text, lastCategorySlug: lastCategorySlug);
      }

      final origin = await _resolveOrigin(text);

      // نستبدل رسالة "يبحث..." الواحدة بفقاعة تحميل واحدة لكل نية مستقلة،
      // بنفس ترتيب النوايا، ثم نملأ كل واحدة بمجرد جاهزيتها (بالتوازي، دون
      // انتظار بعضها البعض) — هذا ما يجعل الرد على رسالة مركّبة (مثل "أقرب
      // مطعم أو أرخص كافيه، وايش العروض المتوفرة؟") يظهر كفقاعات منفصلة.
      final placeholders = [
        for (final intent in intents)
          ChatMessage(
            text: intent.kind == IntentKind.deals
                ? 'يتحقق من العروض القريبة...'
                : 'يبحث عن ${intent.label}...',
            sender: MessageSender.bot,
            isLoading: true,
          ),
      ];

      setState(() {
        _messages.removeLast(); // إزالة رسالة "يبحث..." الأولية
        _messages.addAll(placeholders);
      });
      final startIndex = _messages.length - placeholders.length;
      _scrollToBottom();

      final futures = <Future<void>>[];
      for (var i = 0; i < intents.length; i++) {
        final index = startIndex + i;
        futures.add(
          _resolveIntentMessage(intents[i], origin, usedFallback).then((message) {
            if (!mounted) return;
            setState(() => _messages[index] = message);
            _scrollToBottom();
          }),
        );
      }
      await Future.wait(futures);

      for (final intent in intents) {
        if (intent.kind == IntentKind.place && intent.slug != null) {
          await _sessionMemory.saveLastCategorySlug(intent.slug!);
          break;
        }
      }

      if (origin.offerSaveHome && mounted) {
        setState(() {
          _messages.add(ChatMessage(
            text: 'تبي أحفظ موقعك الحالي كـ"بيتي" عشان أستخدمه في طلباتك الجاية؟',
            sender: MessageSender.bot,
            actionLabel: 'احفظ موقعي كبيتي',
            onAction: () async {
              await _sessionMemory.saveHome(origin.lat, origin.lng);
              if (!mounted) return;
              setState(() {
                _messages.add(ChatMessage(
                  text: 'تم ✅ حفظت موقعك كـ"بيتي".',
                  sender: MessageSender.bot,
                ));
              });
              _scrollToBottom();
            },
          ));
        });
      }
    } on LocationException catch (e) {
      // فشل تحديد نقطة الانطلاق نفسها (قبل إنشاء فقاعات النوايا) — يوقف
      // الرد كاملاً لأن كل النوايا تعتمد على الموقع.
      setState(() {
        _messages.removeLast();
        _messages.add(ChatMessage(
          text: e.message,
          sender: MessageSender.bot,
          actionLabel: e.type == LocationErrorType.unknown ? null : 'فتح الإعدادات',
          onAction: switch (e.type) {
            LocationErrorType.serviceDisabled => () => Geolocator.openLocationSettings(),
            LocationErrorType.permissionDenied ||
            LocationErrorType.permissionDeniedForever =>
              () => Geolocator.openAppSettings(),
            LocationErrorType.unknown => null,
          },
        ));
      });
    } catch (e) {
      setState(() {
        _messages.removeLast();
        _messages.add(ChatMessage(
          text: 'حدث خطأ غير متوقع، حاول مرة أخرى 😕',
          sender: MessageSender.bot,
        ));
      });
    } finally {
      setState(() => _sending = false);
      _scrollToBottom();
    }
  }

  Widget _quickChip(String label) {
    return ActionChip(
      label: Text(label, style: const TextStyle(fontSize: 12.5)),
      backgroundColor: AppColors.surfaceMuted,
      onPressed: _sending
          ? null
          : () {
              _controller.text = label;
              _handleSend();
            },
    );
  }

  @override
  Widget build(BuildContext context) {
    return Directionality(
      textDirection: TextDirection.rtl,
      child: Scaffold(
        backgroundColor: AppColors.background,
        appBar: AppBar(
          backgroundColor: AppColors.primary,
          elevation: 0,
          title: const Row(
            mainAxisAlignment: MainAxisAlignment.end,
            children: [
              Text('ريكو', style: TextStyle(fontWeight: FontWeight.bold)),
              SizedBox(width: 8),
              Icon(Icons.location_on, size: 20),
            ],
          ),
          actions: [
            IconButton(
              icon: const Icon(Icons.bookmark_border),
              tooltip: 'المفضّلة',
              onPressed: () {
                Navigator.of(context).push(
                  MaterialPageRoute(builder: (_) => const FavoritesScreen()),
                );
              },
            ),
          ],
        ),
        body: Column(
          children: [
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              child: Wrap(
                alignment: WrapAlignment.end,
                spacing: 8,
                runSpacing: 4,
                children: [
                  _quickChip('أقرب مطعم'),
                  _quickChip('أرخص كافيه'),
                  _quickChip('أقرب صيدلية'),
                  _quickChip('أقرب محطة بنزين'),
                  _quickChip('العروض القريبة'),
                ],
              ),
            ),
            Expanded(
              child: ListView.builder(
                controller: _scrollController,
                padding: const EdgeInsets.only(top: 8, bottom: 8),
                itemCount: _messages.length,
                itemBuilder: (context, index) =>
                    MessageBubble(message: _messages[index]),
              ),
            ),
            SafeArea(
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                decoration: const BoxDecoration(
                  color: Colors.white,
                  border: Border(top: BorderSide(color: AppColors.border)),
                ),
                child: Row(
                  children: [
                    IconButton(
                      icon: const Icon(Icons.send, color: AppColors.primary),
                      onPressed: _handleSend,
                    ),
                    Expanded(
                      child: TextField(
                        controller: _controller,
                        textAlign: TextAlign.right,
                        onSubmitted: (_) => _handleSend(),
                        decoration: InputDecoration(
                          hintText: 'اكتب طلبك... مثل "أقرب مطعم"',
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(AppRadii.input),
                            borderSide: BorderSide.none,
                          ),
                          filled: true,
                          fillColor: AppColors.surfaceMuted,
                          contentPadding:
                              const EdgeInsets.symmetric(horizontal: 16),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
