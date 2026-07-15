import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import '../models/chat_message.dart';
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
      final usedFallback = classification == null;

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

      // نستبدل نص "يبحث..." برد طبيعي قصير من الـLLM يقرّ بطلب المستخدم تحديداً
      if (classification?.reply != null) {
        setState(() {
          _messages[_messages.length - 1] = ChatMessage(
            text: classification!.reply!,
            sender: MessageSender.bot,
            isLoading: true,
          );
        });
      }

      final lastCategorySlug = await _sessionMemory.getLastCategorySlug();
      final intent = classification?.toQueryIntent() ??
          IntentService.parse(text, lastCategorySlug: lastCategorySlug);
      final origin = await _resolveOrigin(text);

      if (intent.slug != null) {
        await _sessionMemory.saveLastCategorySlug(intent.slug!);
      }

      final places = await _placesService.search(
        userLat: origin.lat,
        userLng: origin.lng,
        tags: intent.tags,
        cheapest: intent.wantsCheapest,
        openNow: intent.wantsOpenNow,
        brandHint: intent.brandHint,
      );

      setState(() {
        _messages.removeLast(); // إزالة رسالة "يبحث..."
        if (places.isEmpty) {
          _messages.add(ChatMessage(
            text: 'لم أجد ${intent.label} قريب منك حالياً 😕 جرّب توسيع نطاق البحث أو نوع مختلف.',
            sender: MessageSender.bot,
          ));
        } else {
          var introText = intent.wantsCheapest
              ? 'رتبت لك أقرب ${intent.label} (الأقرب غالباً أوفر بسبب توفير وقت ومشوار):'
              : 'هذي أقرب ${intent.label} لموقعك:';

          if (intent.wantsOpenNow) {
            final anyConfirmedOpen = places.any((p) => p.isOpenNow == true);
            introText = anyConfirmedOpen
                ? 'هذي أقرب ${intent.label} المفتوحة الآن:'
                : 'ما قدرت أتأكد من مواعيد الدوام بدقة، بس هذي أقرب ${intent.label}:';
          }

          if (usedFallback) {
            introText +=
                '\n(ما قدرت أتأكد من نوع طلبك بدقة، صحح لي إذا ما كان قصدك 🙂)';
          }

          _messages.add(ChatMessage(
            text: introText,
            sender: MessageSender.bot,
            places: places,
          ));
        }

        if (origin.offerSaveHome) {
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
        }
      });
    } on LocationException catch (e) {
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
    } on PlacesException catch (e) {
      setState(() {
        _messages.removeLast();
        _messages.add(ChatMessage(text: e.message, sender: MessageSender.bot));
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
