import 'package:flutter/foundation.dart';
import 'deal.dart';
import 'place_result.dart';

enum MessageSender { user, bot }

class ChatMessage {
  final String text;
  final MessageSender sender;
  final List<PlaceResult>? places;
  final List<Deal>? deals;
  final bool isLoading;
  final DateTime timestamp;
  final String? actionLabel;
  final VoidCallback? onAction;

  ChatMessage({
    required this.text,
    required this.sender,
    this.places,
    this.deals,
    this.isLoading = false,
    this.actionLabel,
    this.onAction,
    DateTime? timestamp,
  }) : timestamp = timestamp ?? DateTime.now();
}
