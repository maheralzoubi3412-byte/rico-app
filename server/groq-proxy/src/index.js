const CATEGORIES = [
  'restaurant',
  'cafe',
  'pharmacy',
  'supermarket',
  'fuel',
  'mall',
  'atm',
  'bank',
  'hospital',
  'clinic',
  'fitness_centre',
];

const OTHER_TAG_KEYS = ['amenity', 'shop', 'leisure', 'tourism', 'office', 'craft'];

const SYSTEM_PROMPT = `أنت مصنّف نوايا لتطبيق "ريكو" الذي يساعد المستخدمين في السعودية على إيجاد أقرب مكان.
مهمتك تصنيف رسالة المستخدم الحالية إلى واحدة من هذه الفئات، وليس الدردشة معه:
${CATEGORIES.join(', ')}, other, off_topic

قد تُرسل معها رسائل سابقة من نفس المحادثة (history) لتوفير السياق.

القواعد:
- إذا كانت الرسالة الحالية استكمالاً أو تعديلاً لطلب سابق (مثل "أبعد شوي"، "بس المفتوح الحين"، "نفس الشي بس أرخص")، استخدم history لتحديد الفئة الصحيحة بدلاً من افتراض off_topic.
- استخدم "off_topic" فقط لرسالة لا تطلب إيجاد مكان قريب ولا هي استكمال لطلب سابق (تحية، سؤال عام، شكر، دردشة عابرة...).
- إذا كان طلب المستخدم يخص مكاناً حقيقياً لكنه لا يطابق أياً من الفئات الثابتة أعلاه (مثل "مغسلة سيارات" أو "محل حلاقة")، استخدم الفئة "other" مع:
  - customTag: تخمين لوسم OpenStreetMap مناسب، بالشكل {"key": "...", "value": "..."} حيث key يجب أن يكون أحد: ${OTHER_TAG_KEYS.join(', ')}، وvalue بحروف إنجليزية صغيرة وأرقام و underscore فقط (مثال: {"key":"shop","value":"car_wash"}).
  - label: اسم عربي قصير للفئة (مثال: "مغسلة سيارات").
- اجعل wantsCheapest=true فقط إذا طلب المستخدم صريحاً "الأرخص" أو "الأوفر" أو ذكر عرضاً.
- اجعل wantsOpenNow=true فقط إذا طلب المستخدم صراحة مكاناً "مفتوح الحين/الآن" أو "فاتح الحين".
- اجعل brandHint اسم العلامة التجارية أو المكان المحدد فقط إذا ذكره المستخدم صراحة (مثال: "ستاربكس")، وإلا اجعله null.
- اكتب reply فقط إذا كانت الفئة off_topic: جملة عربية قصيرة وودودة واحدة تذكّر
  المستخدم بلطف أن ريكو مخصص لإيجاد أقرب مطعم أو كافيه أو صيدلية وغيرها، مع
  مثال مثل "أقرب مطعم". لغير ذلك اجعل reply=null دائماً (لا حاجة له).

أعد الناتج بصيغة JSON فقط بدون أي نص إضافي وبالشكل التالي بالضبط:
{"category": "...", "wantsCheapest": true|false, "wantsOpenNow": true|false, "brandHint": "..."|null, "customTag": {"key": "...", "value": "..."}|null, "label": "..."|null, "reply": "..."|null}`;

function isValidHistory(history) {
  if (history === undefined) return true;
  if (!Array.isArray(history) || history.length > 6) return false;
  return history.every(
    (m) =>
      m &&
      (m.role === 'user' || m.role === 'assistant') &&
      typeof m.content === 'string' &&
      m.content.length > 0 &&
      m.content.length <= 300,
  );
}

function jsonResponse(obj, status) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export default {
  async fetch(request, env) {
    if (request.method !== 'POST') {
      return jsonResponse({ error: 'method_not_allowed' }, 405);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ error: 'invalid_json' }, 400);
    }

    const message = (body && body.message ? String(body.message) : '').trim();
    if (!message || message.length > 500) {
      return jsonResponse({ error: 'invalid_message' }, 400);
    }

    const history = body ? body.history : undefined;
    if (!isValidHistory(history)) {
      return jsonResponse({ error: 'invalid_history' }, 400);
    }

    if (!env.GROQ_API_KEY) {
      return jsonResponse({ error: 'server_misconfigured' }, 500);
    }

    let groqResponse;
    try {
      groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.GROQ_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: env.GROQ_MODEL || 'meta-llama/llama-4-scout-17b-16e-instruct',
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            ...(history || []),
            { role: 'user', content: message },
          ],
          response_format: { type: 'json_object' },
          temperature: 0,
          max_tokens: 200,
        }),
      });
    } catch {
      return jsonResponse({ error: 'upstream_unreachable' }, 502);
    }

    if (!groqResponse.ok) {
      return jsonResponse({ error: 'upstream_error', status: groqResponse.status }, 502);
    }

    const data = await groqResponse.json();
    const content = data && data.choices && data.choices[0] && data.choices[0].message
      ? data.choices[0].message.content
      : null;

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch {
      return jsonResponse({ error: 'parse_error' }, 502);
    }

    const category = parsed.category;
    if (category !== 'off_topic' && category !== 'other' && !CATEGORIES.includes(category)) {
      return jsonResponse({ error: 'invalid_category' }, 502);
    }

    let customTag = null;
    let label = null;
    if (category === 'other') {
      const tag = parsed.customTag;
      const key = tag && typeof tag.key === 'string' ? tag.key : '';
      const value = tag && typeof tag.value === 'string' ? tag.value : '';
      const rawLabel = typeof parsed.label === 'string' ? parsed.label.trim() : '';

      if (
        !OTHER_TAG_KEYS.includes(key) ||
        !/^[a-z0-9_]+$/.test(value) ||
        !rawLabel ||
        rawLabel.length > 40
      ) {
        return jsonResponse({ error: 'invalid_category' }, 502);
      }

      customTag = { key, value };
      label = rawLabel;
    }

    const brandHintRaw = typeof parsed.brandHint === 'string' ? parsed.brandHint.trim() : '';

    return jsonResponse(
      {
        category,
        wantsCheapest: parsed.wantsCheapest === true,
        wantsOpenNow: parsed.wantsOpenNow === true,
        brandHint: brandHintRaw && brandHintRaw.length <= 60 ? brandHintRaw : null,
        customTag,
        label,
        reply: typeof parsed.reply === 'string' ? parsed.reply : null,
      },
      200,
    );
  },
};
