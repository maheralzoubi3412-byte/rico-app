import 'package:flutter/material.dart';
import 'screens/chat_screen.dart';

void main() {
  runApp(const RicoApp());
}

class RicoApp extends StatelessWidget {
  const RicoApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'ريكو',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        primaryColor: const Color(0xFF0F9D58),
        fontFamily: 'Tajawal',
        scaffoldBackgroundColor: const Color(0xFFF7F8FA),
      ),
      home: const ChatScreen(),
    );
  }
}
