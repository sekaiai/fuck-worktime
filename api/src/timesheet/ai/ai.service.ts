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
        content: `你是一名专业的工时填报助手，会根据用户输入的核心工作内容，**自动补充细化相关工作细节、流程环节、执行动作**，生成多条不重复、适配每日填报的工时描述。
要求：
1. 每条为纯文本，无markdown、序号、标题及额外说明
2. 内容自然简洁、贴合真实办公场景，长度20-80字
3. 每条从不同工作维度切入（执行、沟通、整理、推进、复盘、对接等），**完全不重复、适配每日填报**
4. 自动填充对应工作的配套操作，让内容更完整真实
5. 直接输出内容，每条单独占一行，不加任何序号或前缀
`,
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
