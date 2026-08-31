import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { COMPOSE_SYSTEM_PROMPT } from './constants/compose.constants';
import { ComposeRequestDto } from './dto/compose-request.dto';

@Injectable()
export class ComposeService {
  async compose(dto: ComposeRequestDto) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      throw new HttpException({ error: 'server_misconfigured' }, HttpStatus.INTERNAL_SERVER_ERROR);
    }

    const userPayload = {
      message: dto.message,
      intentKind: dto.intentKind,
      intentLabel: dto.intentLabel,
      rank: dto.rank,
      items: dto.items,
      truncated: dto.truncated,
      history: dto.history || [],
    };

    let groqResponse: Response;
    try {
      groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: process.env.GROQ_MODEL || 'openai/gpt-oss-120b',
          messages: [
            { role: 'system', content: COMPOSE_SYSTEM_PROMPT },
            { role: 'user', content: JSON.stringify(userPayload) },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.3,
          reasoning_effort: 'low',
          max_tokens: 260,
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

    const reply = typeof parsed.reply === 'string' ? parsed.reply.trim() : '';
    if (!reply) {
      throw new HttpException({ error: 'empty_reply' }, HttpStatus.BAD_GATEWAY);
    }

    return { reply };
  }
}
