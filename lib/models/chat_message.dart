import 'place_result.dart';

enum MessageSender { user, bot }

class ChatMessage {
  final String text;
  final MessageSender sender;
  final List<PlaceResult>? places;
  final bool isLoading;
  final DateTime timestamp;

  ChatMessage({
    required this.text,
    required this.sender,
    this.places,
    this.isLoading = false,
    DateTime? timestamp,
  }) : timestamp = timestamp ?? DateTime.now();
}
