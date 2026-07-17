// Multi-intent LLM classifier — ported from server/groq-proxy/src/index.js.
// Consolidated into this one backend instead of a separate deployment
// (Node doesn't have the Workers "keep small stateless functions separate"
// pressure that justified two Workers originally).

import express from 'express';
import cors from 'cors';

const router = express.Router();

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
  'clothing_store',
];

const OTHER_TAG_KEYS = ['amenity', 'shop', 'leisure', 'tourism', 'office', 'craft'];
const RANKS = ['nearest', 'cheapest', 'open_now', 'best_rated'];
const MAX_INTENTS = 3;

const SYSTEM_PROMPT = `أنت مصنّف نوايا لتطبيق "ريكو" الذي يساعد المستخدمين في السعودية على إيجاد أقرب مكان والعروض المتاحة، وليس للدردشة معه.

قد تحتوي رسالة واحدة أكثر من طلب مستقل مفصولة بـ"و" أو "أو" أو "،" (مثال: "أقرب مطعم أو أرخص كافيه، وايش العروض المتوفرة؟"). هذا مهم جداً وهو مصدر أخطاء متكرر: يجب أن تحلّل *كل* طلب مستقل ذُكر في الرسالة، لا أن تختار طلباً واحداً فقط وتتجاهل الباقي — حتى لو كانت الطلبات مفصولة بـ"أو" (أو هنا تعني "أعطني كل هذه الأشياء"، وليست اختياراً بين بديلين تختار منه واحداً). قبل أن تجيب، عُدّ عدد الطلبات المستقلة في الرسالة، وتأكد أن طول القائمة intents يساوي هذا العدد بالضبط (بحد أقصى ${MAX_INTENTS}). إذا كانت الرسالة تطلب شيئاً واحداً فقط، أعد عنصراً واحداً.

مثال كامل — الرسالة: "وش أقرب مطعم أو أرخص كافيه، وايش العروض المتوفرة؟" تحتوي ٣ طلبات مستقلة (مطعم، كافيه، عروض)، لذا الناتج الصحيح:
{"offTopic": false, "reply": null, "intents": [
  {"kind": "place", "category": "restaurant", "rank": "nearest", "brandHint": null, "customTag": null, "label": null},
  {"kind": "place", "category": "cafe", "rank": "cheapest", "brandHint": null, "customTag": null, "label": null},
  {"kind": "deals", "category": null, "rank": "nearest", "brandHint": null, "customTag": null, "label": "العروض"}
]}
ناتج خاطئ لنفس الرسالة (يجب تفاديه): إرجاع عنصر "deals" وحده متجاهلاً طلبي المطعم والكافيه، أو إرجاع عنصر واحد فقط بشكل عام لرسالة تحتوي عدة طلبات.

قد تُرسل معها رسائل سابقة من نفس المحادثة (history) لتوفير السياق. إذا كانت الرسالة الحالية استكمالاً أو تعديلاً لطلب سابق (مثل "أبعد شوي"، "بس المفتوح الحين"، "نفس الشي بس أرخص")، استخدم history لتحديد النية الصحيحة بدلاً من افتراض offTopic.

كل عنصر في intents يمثّل أحد نوعين (kind):
- "place": طلب إيجاد مكان.
  - category يجب أن تكون إحدى هذه الفئات بالضبط: ${CATEGORIES.join(', ')}, other.
  - إذا كان الطلب يخص مكاناً حقيقياً لا يطابق أياً من الفئات الثابتة (مثل "مغسلة سيارات" أو "محل حلاقة")، استخدم category="other" مع:
    - customTag: تخمين لوسم OpenStreetMap مناسب، بالشكل {"key": "...", "value": "..."} حيث key يجب أن يكون أحد: ${OTHER_TAG_KEYS.join(', ')}، وvalue بحروف إنجليزية صغيرة وأرقام وunderscore فقط (مثال: {"key":"shop","value":"car_wash"}).
    - label: اسم عربي قصير للفئة (مثال: "مغسلة سيارات").
  - لغير "other" اجعل customTag=null وlabel=null.
  - rank يجب أن تكون واحدة من: "nearest" (افتراضي، أقرب مكان)، "cheapest" (طلب صريح "الأرخص"/"الأوفر")، "open_now" (طلب صريح مكان "مفتوح الحين/الآن"/"فاتح الحين")، "best_rated" (طلب صريح "الأفضل تقييماً"/"الأعلى تقييم"). إذا لم يُذكر شيء صريح، استخدم "nearest".
  - brandHint اسم العلامة التجارية أو المكان المحدد فقط إذا ذكره المستخدم صراحة (مثال: "ستاربكس")، وإلا اجعله null.
- "deals": طلب عروض أو خصومات (مثال: "وش العروض المتوفرة؟"، "فيه خصومات؟"). category=null, rank="nearest", customTag=null, brandHint=null, label="العروض" (أو اسم عربي قصير مشابه إذا ذكر المستخدم نوعاً محدداً من العروض).

استخدم offTopic=true فقط لرسالة لا تطلب مكاناً ولا عروضاً ولا هي استكمال لطلب سابق (تحية، سؤال عام، شكر، دردشة عابرة...)، واجعل intents مصفوفة فارغة []. اكتب reply في هذه الحالة فقط: جملة عربية قصيرة وودودة واحدة تذكّر المستخدم بلطف أن ريكو مخصص لإيجاد أقرب مطعم أو كافيه أو صيدلية وغيرها والعروض المتاحة، مع مثال مثل "أقرب مطعم". لغير ذلك اجعل reply=null دائماً (لا حاجة له).

أعد الناتج بصيغة JSON فقط بدون أي نص إضافي وبالشكل التالي بالضبط:
{"offTopic": true|false, "reply": "..."|null, "intents": [{"kind": "place"|"deals", "category": "..."|null, "rank": "nearest"|"cheapest"|"open_now"|"best_rated", "brandHint": "..."|null, "customTag": {"key": "...", "value": "..."}|null, "label": "..."|null}]}`;

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

// Validates one intent element, or returns null if it's unsalvageable — an
// invalid element is dropped rather than rejecting the whole message.
function validateIntent(raw) {
  if (!raw || typeof raw !== 'object') return null;

  if (raw.kind === 'deals') {
    const rawLabel = typeof raw.label === 'string' ? raw.label.trim() : '';
    return {
      kind: 'deals',
      category: null,
      rank: 'nearest',
      brandHint: null,
      customTag: null,
      label: rawLabel && rawLabel.length <= 40 ? rawLabel : 'العروض',
    };
  }

  if (raw.kind !== 'place') return null;

  const category = raw.category;
  if (category !== 'other' && !CATEGORIES.includes(category)) return null;

  const rank = RANKS.includes(raw.rank) ? raw.rank : 'nearest';

  let customTag = null;
  let label = null;
  if (category === 'other') {
    const tag = raw.customTag;
    const key = tag && typeof tag.key === 'string' ? tag.key : '';
    const value = tag && typeof tag.value === 'string' ? tag.value : '';
    const rawLabel = typeof raw.label === 'string' ? raw.label.trim() : '';

    if (
      !OTHER_TAG_KEYS.includes(key) ||
      !/^[a-z0-9_]+$/.test(value) ||
      !rawLabel ||
      rawLabel.length > 40
    ) {
      return null;
    }

    customTag = { key, value };
    label = rawLabel;
  }

  const brandHintRaw = typeof raw.brandHint === 'string' ? raw.brandHint.trim() : '';

  return {
    kind: 'place',
    category,
    rank,
    brandHint: brandHintRaw && brandHintRaw.length <= 60 ? brandHintRaw : null,
    customTag,
    label,
  };
}

router.post('/classify', cors(), async (req, res) => {
  const message = (req.body && req.body.message ? String(req.body.message) : '').trim();
  if (!message || message.length > 500) {
    return res.status(400).json({ error: 'invalid_message' });
  }

  const history = req.body ? req.body.history : undefined;
  if (!isValidHistory(history)) {
    return res.status(400).json({ error: 'invalid_history' });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'server_misconfigured' });
  }

  let groqResponse;
  try {
    groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.GROQ_MODEL || 'meta-llama/llama-4-scout-17b-16e-instruct',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          ...(history || []),
          { role: 'user', content: message },
        ],
        response_format: { type: 'json_object' },
        temperature: 0,
        max_tokens: 350,
      }),
    });
  } catch {
    return res.status(502).json({ error: 'upstream_unreachable' });
  }

  if (!groqResponse.ok) {
    return res.status(502).json({ error: 'upstream_error', status: groqResponse.status });
  }

  const data = await groqResponse.json();
  const content =
    data && data.choices && data.choices[0] && data.choices[0].message
      ? data.choices[0].message.content
      : null;

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch {
    return res.status(502).json({ error: 'parse_error' });
  }

  if (parsed.offTopic === true) {
    return res.json({
      offTopic: true,
      reply: typeof parsed.reply === 'string' ? parsed.reply : null,
      intents: [],
    });
  }

  const rawIntents = Array.isArray(parsed.intents) ? parsed.intents.slice(0, MAX_INTENTS) : [];
  const intents = rawIntents.map(validateIntent).filter(Boolean);

  if (intents.length === 0) {
    return res.status(502).json({ error: 'invalid_intents' });
  }

  res.json({ offTopic: false, reply: null, intents });
});

export default router;
