import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import '../models/chat_message.dart';
import '../services/intent_service.dart';
import '../services/llm_intent_service.dart';
import '../services/location_service.dart';
import '../services/places_service.dart';
import '../widgets/message_bubble.dart';

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
      final classification = await LlmIntentService.classify(text);

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

      final intent = classification?.toQueryIntent() ?? IntentService.parse(text);
      final position = await _getPosition();

      final places = await _placesService.search(
        userLat: position.latitude,
        userLng: position.longitude,
        tags: intent.tags,
        cheapest: intent.wantsCheapest,
      );

      setState(() {
        _messages.removeLast(); // إزالة رسالة "يبحث..."
        if (places.isEmpty) {
          _messages.add(ChatMessage(
            text: 'لم أجد ${intent.label} قريب منك حالياً 😕 جرّب توسيع نطاق البحث أو نوع مختلف.',
            sender: MessageSender.bot,
          ));
        } else {
          final introText = intent.wantsCheapest
              ? 'مصدر البيانات المجاني لا يوفر أسعاراً دقيقة، فرتبت لك أقرب ${intent.label} (الأقرب غالباً أوفر بسبب توفير وقت ومشوار):'
              : 'هذي أقرب ${intent.label} لموقعك:';
          _messages.add(ChatMessage(
            text: introText,
            sender: MessageSender.bot,
            places: places,
          ));
        }
      });
    } catch (e) {
      setState(() {
        _messages.removeLast();
        _messages.add(ChatMessage(
          text: e.toString(),
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
      backgroundColor: const Color(0xFFF3F4F6),
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
        backgroundColor: const Color(0xFFF7F8FA),
        appBar: AppBar(
          backgroundColor: const Color(0xFF0F9D58),
          elevation: 0,
          title: const Row(
            mainAxisAlignment: MainAxisAlignment.end,
            children: [
              Text('ريكو', style: TextStyle(fontWeight: FontWeight.bold)),
              SizedBox(width: 8),
              Icon(Icons.location_on, size: 20),
            ],
          ),
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
                  border: Border(top: BorderSide(color: Color(0xFFE6E6E6))),
                ),
                child: Row(
                  children: [
                    IconButton(
                      icon: const Icon(Icons.send, color: Color(0xFF0F9D58)),
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
                            borderRadius: BorderRadius.circular(24),
                            borderSide: BorderSide.none,
                          ),
                          filled: true,
                          fillColor: const Color(0xFFF3F4F6),
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
