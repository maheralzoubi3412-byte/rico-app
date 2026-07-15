import 'package:flutter/material.dart';
import '../models/chat_message.dart';
import '../theme/app_theme.dart';
import 'place_card.dart';

class MessageBubble extends StatelessWidget {
  final ChatMessage message;

  const MessageBubble({super.key, required this.message});

  @override
  Widget build(BuildContext context) {
    final isUser = message.sender == MessageSender.user;

    return Align(
      alignment: isUser ? Alignment.centerLeft : Alignment.centerRight,
      child: Container(
        margin: const EdgeInsets.symmetric(vertical: 6, horizontal: 12),
        constraints: BoxConstraints(
            maxWidth: MediaQuery.of(context).size.width * 0.8),
        child: Column(
          crossAxisAlignment:
              isUser ? CrossAxisAlignment.start : CrossAxisAlignment.end,
          children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
              decoration: BoxDecoration(
                color: isUser ? AppColors.userBubble : AppColors.primary,
                borderRadius: BorderRadius.circular(AppRadii.bubble),
              ),
              child: message.isLoading
                  ? Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(
                              strokeWidth: 2, color: Colors.white),
                        ),
                        if (message.text.isNotEmpty) ...[
                          const SizedBox(width: 10),
                          Flexible(
                            child: Text(
                              message.text,
                              style: const TextStyle(color: Colors.white, fontSize: 15),
                            ),
                          ),
                        ],
                      ],
                    )
                  : Text(
                      message.text,
                      style: TextStyle(
                        color: isUser ? Colors.black87 : Colors.white,
                        fontSize: 15,
                      ),
                    ),
            ),
            if (message.actionLabel != null && message.onAction != null)
              Padding(
                padding: const EdgeInsets.only(top: 6),
                child: OutlinedButton(
                  onPressed: message.onAction,
                  style: OutlinedButton.styleFrom(
                    foregroundColor: AppColors.primary,
                    side: const BorderSide(color: AppColors.primary),
                    minimumSize: const Size(0, 40),
                  ),
                  child: Text(message.actionLabel!),
                ),
              ),
            if (message.places != null && message.places!.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Column(
                  children: [
                    for (var i = 0; i < message.places!.length; i++)
                      PlaceCard(place: message.places![i], rank: i + 1),
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }
}
