import 'package:flutter/material.dart';
import '../theme/app_theme.dart';

/// حقل كتابة الرسالة — حبة بيضاء مرفوعة عن الأرضية العاجية، وزر إرسال يتلوّن
/// بالأخضر فقط حين يوجد نص فعلي (وحلقة تحميل مكانه أثناء الإرسال)، فيكون
/// حال الزر انعكاساً صادقاً لما يمكن فعله الآن.
class ChatComposer extends StatefulWidget {
  final TextEditingController controller;
  final VoidCallback onSend;

  /// جارٍ تنفيذ طلب — يُعطّل الإرسال ويُظهر مؤشر تقدّم مكان السهم.
  final bool busy;

  /// شريط الاقتراحات الأفقي، يُخفى تلقائياً أثناء الكتابة.
  final Widget? suggestions;

  const ChatComposer({
    super.key,
    required this.controller,
    required this.onSend,
    required this.busy,
    this.suggestions,
  });

  @override
  State<ChatComposer> createState() => _ChatComposerState();
}

class _ChatComposerState extends State<ChatComposer> {
  final FocusNode _focusNode = FocusNode();
  bool _hasText = false;

  @override
  void initState() {
    super.initState();
    _hasText = widget.controller.text.trim().isNotEmpty;
    widget.controller.addListener(_onTextChanged);
  }

  @override
  void dispose() {
    widget.controller.removeListener(_onTextChanged);
    _focusNode.dispose();
    super.dispose();
  }

  void _onTextChanged() {
    final hasText = widget.controller.text.trim().isNotEmpty;
    if (hasText != _hasText) setState(() => _hasText = hasText);
  }

  bool get _canSend => _hasText && !widget.busy;

  @override
  Widget build(BuildContext context) {
    final suggestions = widget.suggestions;

    return Container(
      decoration: const BoxDecoration(
        color: RicoColors.canvas,
        border: Border(top: BorderSide(color: RicoColors.hairline)),
      ),
      child: SafeArea(
        top: false,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // شريط الاقتراحات يختفي بمجرد بدء الكتابة — النص الذي يكتبه
            // المستخدم أولى بالمساحة من اقتراحات لم يطلبها.
            if (suggestions != null)
              AnimatedSize(
                duration: const Duration(milliseconds: 180),
                curve: Curves.easeOut,
                child: _hasText ? const SizedBox(width: double.infinity) : suggestions,
              ),
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 8, 12, 10),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Expanded(
                    child: Container(
                      decoration: BoxDecoration(
                        color: RicoColors.surface,
                        borderRadius: BorderRadius.circular(RicoRadii.composer),
                        border: Border.all(
                          color: _focusNode.hasFocus ? RicoColors.primary.withValues(alpha: 0.5) : RicoColors.hairlineStrong,
                        ),
                        boxShadow: RicoShadows.subtle,
                      ),
                      child: TextField(
                        controller: widget.controller,
                        focusNode: _focusNode,
                        // إعادة البناء عند التركيز/فقده لتلوين حافة الحبة.
                        onTapOutside: (_) => setState(() => _focusNode.unfocus()),
                        onTap: () => setState(() {}),
                        style: RicoText.body.copyWith(color: RicoColors.ink),
                        cursorColor: RicoColors.primary,
                        maxLines: 4,
                        minLines: 1,
                        textInputAction: TextInputAction.send,
                        keyboardType: TextInputType.multiline,
                        onSubmitted: (_) => _canSend ? widget.onSend() : null,
                        decoration: InputDecoration(
                          isDense: true,
                          hintText: 'اكتب طلبك… مثل «أقرب مطعم»',
                          hintStyle: RicoText.body.copyWith(color: RicoColors.inkFaint),
                          filled: false,
                          border: InputBorder.none,
                          enabledBorder: InputBorder.none,
                          focusedBorder: InputBorder.none,
                          contentPadding: const EdgeInsets.symmetric(horizontal: 18, vertical: 13),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  _SendButton(enabled: _canSend, busy: widget.busy, onTap: widget.onSend),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SendButton extends StatelessWidget {
  final bool enabled;
  final bool busy;
  final VoidCallback onTap;

  const _SendButton({required this.enabled, required this.busy, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: 'إرسال',
      child: GestureDetector(
        onTap: enabled ? onTap : null,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          width: 48,
          height: 48,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            gradient: enabled
                ? const LinearGradient(
                    begin: Alignment.topRight,
                    end: Alignment.bottomLeft,
                    colors: [RicoColors.primaryLift, RicoColors.primaryDeep],
                  )
                : null,
            color: enabled ? null : RicoColors.surfaceSunken,
            shape: BoxShape.circle,
            boxShadow: enabled ? RicoShadows.brand : const [],
          ),
          child: busy
              ? const SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(strokeWidth: 2, color: RicoColors.inkFaint),
                )
              // الأيقونة مرآة تلقائياً في RTL فتشير لجهة الكتابة الصحيحة.
              : Icon(
                  Icons.send_rounded,
                  size: 20,
                  color: enabled ? Colors.white : RicoColors.inkFaint,
                ),
        ),
      ),
    );
  }
}

/// شريط اقتراحات أفقي فوق حقل الكتابة — بديل عن كتلة الحبوب الثابتة التي
/// كانت تقتطع أعلى المحادثة دائماً.
class SuggestionRail extends StatelessWidget {
  final void Function(String prompt) onPick;

  const SuggestionRail({super.key, required this.onPick});

  static const List<({IconData icon, String label, String prompt})> _items = [
    (icon: Icons.restaurant_rounded, label: 'أقرب مطعم', prompt: 'أقرب مطعم'),
    (icon: Icons.local_cafe_rounded, label: 'أرخص كافيه', prompt: 'أرخص كافيه'),
    (icon: Icons.local_offer_rounded, label: 'عروض قريبة', prompt: 'وش العروض القريبة؟'),
    (icon: Icons.local_pharmacy_rounded, label: 'صيدلية', prompt: 'أقرب صيدلية'),
    (icon: Icons.local_gas_station_rounded, label: 'بنزين', prompt: 'أقرب محطة بنزين'),
    (icon: Icons.hotel_rounded, label: 'فندق', prompt: 'أقرب فندق'),
    (icon: Icons.local_grocery_store_rounded, label: 'بقالة', prompt: 'أقرب بقالة'),
  ];

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 46,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
        itemCount: _items.length,
        separatorBuilder: (_, __) => const SizedBox(width: 8),
        itemBuilder: (context, i) {
          final item = _items[i];
          return _RailChip(icon: item.icon, label: item.label, onTap: () => onPick(item.prompt));
        },
      ),
    );
  }
}

class _RailChip extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback onTap;

  const _RailChip({required this.icon, required this.label, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Material(
      color: RicoColors.surface,
      borderRadius: RicoRadii.pillR,
      child: InkWell(
        onTap: onTap,
        borderRadius: RicoRadii.pillR,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 13),
          decoration: BoxDecoration(
            borderRadius: RicoRadii.pillR,
            border: Border.all(color: RicoColors.hairlineStrong),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, size: 15, color: RicoColors.primary),
              const SizedBox(width: 7),
              Text(label, style: RicoText.label.copyWith(color: RicoColors.inkBody)),
            ],
          ),
        ),
      ),
    );
  }
}
