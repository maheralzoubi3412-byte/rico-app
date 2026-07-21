import 'package:flutter/material.dart';
import 'screens/chat_screen.dart';
import 'theme/app_theme.dart';

void main() {
  runApp(const RicoApp());
}

class RicoApp extends StatelessWidget {
  const RicoApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Rico GO',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light(),
      home: const ChatScreen(),
    );
  }
}
