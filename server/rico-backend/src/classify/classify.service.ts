import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { CATEGORIES, MAX_INTENTS, OTHER_TAG_KEYS, RANKS, SYSTEM_PROMPT } from './constants/classify.constants';
import { ClassifyRequestDto } from './dto/classify-request.dto';

interface Intent {
  kind: 'place' | 'deals';
  category: string | null;
  rank: string;
  brandHint: string | null;
  customTag: { key: string; value: string } | null;
  label: string | null;
}

// Validates one intent element, or returns null if it's unsalvageable — an
// invalid element is dropped rather than rejecting the whole message.
function validateIntent(raw: any): Intent | null {
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
  if (category !== 'other' && !(CATEGORIES as readonly string[]).includes(category)) return null;

  const rank = (RANKS as readonly string[]).includes(raw.rank) ? raw.rank : 'nearest';

  let customTag: { key: string; value: string } | null = null;
  let label: string | null = null;
  if (category === 'other') {
    const tag = raw.customTag;
    const key = tag && typeof tag.key === 'string' ? tag.key : '';
    const value = tag && typeof tag.value === 'string' ? tag.value : '';
    const rawLabel = typeof raw.label === 'string' ? raw.label.trim() : '';

    if (!(OTHER_TAG_KEYS as readonly string[]).includes(key) || !/^[a-z0-9_]+$/.test(value) || !rawLabel || rawLabel.length > 40) {
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

@Injectable()
export class ClassifyService {
  async classify(dto: ClassifyRequestDto) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      throw new HttpException({ error: 'server_misconfigured' }, HttpStatus.INTERNAL_SERVER_ERROR);
    }

    let groqResponse: Response;
    try {
      groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: process.env.GROQ_MODEL || 'meta-llama/llama-4-scout-17b-16e-instruct',
          messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...(dto.history || []), { role: 'user', content: dto.message }],
          response_format: { type: 'json_object' },
          temperature: 0,
          max_tokens: 350,
        }),
      });
    } catch {
      throw new HttpException({ error: 'upstream_unreachable' }, HttpStatus.BAD_GATEWAY);
    }

    if (!groqResponse.ok) {
      throw new HttpException({ error: 'upstream_error', status: groqResponse.status }, HttpStatus.BAD_GATEWAY);
    }

    const data = await groqResponse.json();
    const content = data?.choices?.[0]?.message?.content ?? null;

    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch {
      throw new HttpException({ error: 'parse_error' }, HttpStatus.BAD_GATEWAY);
    }

    if (parsed.offTopic === true) {
      return {
        offTopic: true,
        reply: typeof parsed.reply === 'string' ? parsed.reply : null,
        intents: [],
      };
    }

    const rawIntents = Array.isArray(parsed.intents) ? parsed.intents.slice(0, MAX_INTENTS) : [];
    const intents = rawIntents.map(validateIntent).filter(Boolean);

    if (intents.length === 0) {
      throw new HttpException({ error: 'invalid_intents' }, HttpStatus.BAD_GATEWAY);
    }

    return { offTopic: false, reply: null, intents };
  }
}
