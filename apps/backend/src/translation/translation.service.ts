import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { fromNodeHeaders } from 'better-auth/node';
import type { IncomingHttpHeaders } from 'node:http';

import { auth } from '@repo/auth';
import { TranslateDto, TranslateResponseDto } from './dto/index.js';

// The locale the UI sends → the language name the model translates into.
const LOCALE_LANGUAGE: Record<string, string> = {
  en: 'English',
  si: 'Sinhala',
  ta: 'Tamil',
};

@Injectable()
export class TranslationService {
  private readonly logger = new Logger(TranslationService.name);
  private readonly aiServiceUrl: string;

  constructor(private readonly config: ConfigService) {
    this.aiServiceUrl =
      this.config.get<string>('AI_SERVICE_URL') ?? 'http://localhost:8006';
  }

  async translate(
    dto: TranslateDto,
    headers: IncomingHttpHeaders,
  ): Promise<TranslateResponseDto> {
    // Mint the signed-in user's JWT (aud: ai-service) so the AI service can
    // verify the call via the better-auth JWKS — the AI service is never
    // exposed to the browser directly.
    const token = await this.getServiceToken(headers);

    let response: Response;
    try {
      response = await fetch(
        `${this.aiServiceUrl}/api/v1/assistant/translate`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            text: dto.text,
            target_language: LOCALE_LANGUAGE[dto.targetLocale],
            source_language: dto.sourceLocale
              ? LOCALE_LANGUAGE[dto.sourceLocale]
              : undefined,
          }),
        },
      );
    } catch (err) {
      this.logger.error(
        `AI service unreachable at ${this.aiServiceUrl}: ${String(err)}`,
      );
      throw new ServiceUnavailableException('Translation service unavailable');
    }

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      this.logger.error(
        `AI translate failed (${response.status}): ${detail.slice(0, 300)}`,
      );
      throw new ServiceUnavailableException('Translation failed');
    }

    const data = (await response.json()) as {
      translated_text?: string;
      model?: string;
    };
    return {
      translatedText: data.translated_text ?? '',
      model: data.model ?? 'unknown',
    };
  }

  private async getServiceToken(headers: IncomingHttpHeaders): Promise<string> {
    const result = await auth.api.getToken({
      headers: fromNodeHeaders(headers),
    });
    const token = (result as { token?: string } | null)?.token;
    if (!token) {
      throw new ServiceUnavailableException('Could not authorize translation');
    }
    return token;
  }
}
