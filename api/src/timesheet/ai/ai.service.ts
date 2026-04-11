import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import type { AiChatMessage, AiChatResponse } from './ai.types';

const FALLBACK_CONTENT = '日常工作处理';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly apiUrl = 'https://api.siliconflow.cn/v1/chat/completions';

  constructor(private readonly configService: ConfigService) {}

  async generateWorkContents(work: string, days: number): Promise<string[]> {
    const apiKey = this.configService.get<string>('SILICONFLOW_API_KEY');
    if (!apiKey) {
      this.logger.warn('SILICONFLOW_API_KEY not configured, returning fallback');
      return Array.from({ length: days }, () => FALLBACK_CONTENT);
    }

    const model = this.configService.get<string>('SILICONFLOW_MODEL') || 'Qwen/Qwen2.5-7B-Instruct';

    const messages: AiChatMessage[] = [
      {
        role: 'system',
        content: `你是一个工时填报助手。根据用户的工作内容描述，生成指定条数的工时描述。
要求：
1. 每条描述为纯文本，不要包含markdown格式、序号、标题或额外说明
2. 每条描述应该自然、简洁，适合作为工时填报内容
3. 多条描述之间尽量有变化，避免完全重复
4. 每条描述长度适中（30-80字）
5. 直接输出内容，每条占一行，不要加序号或前缀`,
      },
      {
        role: 'user',
        content: `工作内容：${work}\n请生成${days}条工时描述`,
      },
    ];

    try {
      const response = await axios.post<AiChatResponse>(
        this.apiUrl,
        { model, messages },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        },
      );

      const rawContent = response.data.choices[0]?.message?.content || '';
      return this.cleanContent(rawContent, days);
    } catch (error) {
      this.logger.error('AI generation failed, returning fallback', error);
      return Array.from({ length: days }, () => FALLBACK_CONTENT);
    }
  }

  private cleanContent(raw: string, expectedCount: number): string[] {
    let lines = raw
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    lines = lines.map((line) => {
      let cleaned = line;
      cleaned = cleaned.replace(/^\d+[\.\)、]\s*/, '');
      cleaned = cleaned.replace(/^[-*•]\s*/, '');
      cleaned = cleaned.replace(/^#{1,6}\s+/, '');
      cleaned = cleaned.replace(/\*\*(.+?)\*\*/g, '$1');
      cleaned = cleaned.replace(/__(.+?)__/g, '$1');
      cleaned = cleaned.replace(/[*_](.+?)[*_]/g, '$1');
      cleaned = cleaned.replace(/^[（(]?\d+[）)]\s*/, '');
      cleaned = cleaned.replace(/^以下是[：:]\s*/i, '');
      cleaned = cleaned.replace(/^以上是[：:]\s*/i, '');
      cleaned = cleaned.replace(/^好的[，,]\s*/i, '');
      cleaned = cleaned.replace(/^好的[！!]\s*/i, '');
      cleaned = cleaned.trim();
      return cleaned;
    });

    lines = lines.filter((line) => line.length > 0 && line.length < 500);

    if (lines.length === 0) {
      return Array.from({ length: expectedCount }, () => FALLBACK_CONTENT);
    }

    while (lines.length < expectedCount) {
      lines.push(FALLBACK_CONTENT);
    }

    return lines.slice(0, expectedCount);
  }
}
