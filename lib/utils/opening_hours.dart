/// محلل مبسّط وعملي لصياغة OSM الشائعة لوسم opening_hours.
/// لا يغطي الصياغة الكاملة للمواصفة (العطل الرسمية PH/SH، المواسم، أرقام
/// الأسابيع...)؛ عند أي صياغة غير مؤكدة يرجع null بدل التخمين الخاطئ
/// بإغلاق أو فتح المكان.
class OpeningHours {
  OpeningHours._();

  static const List<String> _dayOrder = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

  static final RegExp _dayListPattern = RegExp(
    r'^(Mo|Tu|We|Th|Fr|Sa|Su)(-(Mo|Tu|We|Th|Fr|Sa|Su))?(,(Mo|Tu|We|Th|Fr|Sa|Su)(-(Mo|Tu|We|Th|Fr|Sa|Su))?)*$',
  );

  static final RegExp _timeRangePattern = RegExp(
    r'^([0-2]\d:[0-5]\d)-([0-2]\d:[0-5]\d)(,([0-2]\d:[0-5]\d)-([0-2]\d:[0-5]\d))*$',
  );

  static final RegExp _unsupportedTokens = RegExp(
    r'PH|SH|week|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec',
    caseSensitive: false,
  );

  static bool? isOpenNow(String? openingHours, DateTime now) {
    if (openingHours == null) return null;
    final value = openingHours.trim();
    if (value.isEmpty) return null;
    if (value == '24/7') return true;
    if (_unsupportedTokens.hasMatch(value)) return null;

    bool? result;
    var matchedAnyRule = false;
    final today = _dayOrder[now.weekday - 1];
    final minutesNow = now.hour * 60 + now.minute;

    for (final rawRule in value.split(';')) {
      final rule = rawRule.replaceAll(RegExp(r'\([^)]*\)'), '').trim();
      if (rule.isEmpty) continue;

      final parsed = _parseRule(rule);
      if (parsed == null) return null; // صياغة غير مفهومة: لا نخمّن

      final appliesToday = parsed.days.isEmpty || parsed.days.contains(today);
      if (!appliesToday) continue;

      matchedAnyRule = true;
      if (parsed.isOff) {
        result = false;
      } else {
        result = parsed.ranges.any((r) => _inRange(minutesNow, r.$1, r.$2));
      }
    }

    return matchedAnyRule ? result : null;
  }

  static bool _inRange(int minutes, int start, int end) {
    if (end > start) return minutes >= start && minutes < end;
    // نطاق يعبر منتصف الليل (مثال: 22:00-02:00)
    return minutes >= start || minutes < end;
  }

  static _Rule? _parseRule(String rule) {
    final tokens = rule.split(RegExp(r'\s+'));

    String dayToken;
    String timeToken;
    if (tokens.length == 1) {
      dayToken = '';
      timeToken = tokens[0];
    } else if (tokens.length == 2) {
      dayToken = tokens[0];
      timeToken = tokens[1];
    } else {
      return null; // قاعدة معقّدة غير مدعومة
    }

    var days = <String>{};
    if (dayToken.isNotEmpty) {
      if (!_dayListPattern.hasMatch(dayToken)) return null;
      days = _expandDays(dayToken);
    }

    if (timeToken.toLowerCase() == 'off' || timeToken.toLowerCase() == 'closed') {
      return _Rule(days: days, isOff: true, ranges: const []);
    }

    if (timeToken == '24/7') {
      return _Rule(days: days, isOff: false, ranges: const [(0, 1440)]);
    }

    if (!_timeRangePattern.hasMatch(timeToken)) return null;

    final ranges = timeToken.split(',').map((r) {
      final parts = r.split('-');
      return (_parseTimeToMinutes(parts[0]), _parseTimeToMinutes(parts[1]));
    }).toList();

    return _Rule(days: days, isOff: false, ranges: ranges);
  }

  static Set<String> _expandDays(String dayToken) {
    final result = <String>{};
    for (final segment in dayToken.split(',')) {
      final range = segment.split('-');
      if (range.length == 1) {
        result.add(range[0]);
        continue;
      }
      final startIndex = _dayOrder.indexOf(range[0]);
      final endIndex = _dayOrder.indexOf(range[1]);
      var i = startIndex;
      while (true) {
        result.add(_dayOrder[i]);
        if (i == endIndex) break;
        i = (i + 1) % _dayOrder.length;
      }
    }
    return result;
  }

  static int _parseTimeToMinutes(String hhmm) {
    final parts = hhmm.split(':');
    final hour = int.parse(parts[0]);
    final minute = int.parse(parts[1]);
    return (hour == 24 ? 24 * 60 : hour * 60) + minute;
  }
}

class _Rule {
  final Set<String> days; // فارغة = كل الأيام
  final bool isOff;
  final List<(int, int)> ranges; // دقائق منذ منتصف الليل

  _Rule({required this.days, required this.isOff, required this.ranges});
}
