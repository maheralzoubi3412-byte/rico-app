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

const SYSTEM_PROMPT = `أنت مصنّف نوايا لتطبيق "ريكو" الذي يساعد المستخدمين في السعودية على إيجاد أقرب مكان.
مهمتك فقط تصنيف رسالة المستخدم إلى واحدة من هذه الفئات، وليس الدردشة معه:
${CATEGORIES.join(', ')}, off_topic

القواعد:
- استخدم "off_topic" لأي رسالة لا تطلب إيجاد مكان قريب (تحية، سؤال عام، شكر، دردشة عابرة...).
- اجعل wantsCheapest=true فقط إذا طلب المستخدم صريحاً "الأرخص" أو "الأوفر" أو ذكر عرضاً.
- إذا كانت الفئة off_topic، اكتب في reply رسالة عربية ودّية قصيرة (جملة أو جملتين) تُذكّر المستخدم أن ريكو مخصص لإيجاد أقرب مطعم أو كافيه أو صيدلية وغيرها، مع مثال مثل "أقرب مطعم".
- إذا لم تكن off_topic، اجعل reply = null.

أعد الناتج بصيغة JSON فقط بدون أي نص إضافي وبالشكل التالي بالضبط:
{"category": "...", "wantsCheapest": true|false, "reply": "..."|null}`;

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
            { role: 'user', content: message },
          ],
          response_format: { type: 'json_object' },
          temperature: 0,
          max_tokens: 150,
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
    if (category !== 'off_topic' && !CATEGORIES.includes(category)) {
      return jsonResponse({ error: 'invalid_category' }, 502);
    }

    return jsonResponse(
      {
        category,
        wantsCheapest: parsed.wantsCheapest === true,
        reply: typeof parsed.reply === 'string' ? parsed.reply : null,
      },
      200,
    );
  },
};
