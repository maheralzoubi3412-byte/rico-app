import 'package:flutter/material.dart';
import '../models/chat_message.dart';
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
                color: isUser ? const Color(0xFFEDEDED) : const Color(0xFF0F9D58),
                borderRadius: BorderRadius.circular(18),
              ),
              child: message.isLoading
                  ? const SizedBox(
                      width: 40,
                      height: 18,
                      child: Center(
                        child: SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(
                              strokeWidth: 2, color: Colors.white),
                        ),
                      ),
                    )
                  : Text(
                      message.text,
                      style: TextStyle(
                        color: isUser ? Colors.black87 : Colors.white,
                        fontSize: 15,
                      ),
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
