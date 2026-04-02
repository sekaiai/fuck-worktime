import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { SubmitTimesheetDto } from './dto/submit-timesheet.dto';
import { ProjectDto } from './dto/project.dto';
import { WorkTypeDto } from './dto/work-type.dto';

@Injectable()
export class TimesheetService {
  private readonly logger = new Logger(TimesheetService.name);
  private readonly timesApiBaseUrl = 'https://times.gzdata.com.cn:8099/prod-api';
  private readonly siliconFlowApiUrl = 'https://api.siliconflow.cn/v1/chat/completions';

  constructor(private readonly configService: ConfigService) {}

  private getAuthHeaders(token: string) {
    return {
      Authorization: `Bearer ${token}`,
      Referer: 'https://times.gzdata.com.cn:8099/hours/filling',
    };
  }

  async submitTimesheet(data: SubmitTimesheetDto, token: string): Promise<unknown> {
    try {
      const response = await axios.post(
        `${this.timesApiBaseUrl}/working/timing/repor`,
        data,
        {
          headers: this.getAuthHeaders(token),
        },
      );
      return response.data;
    } catch (error) {
      this.logger.error('Failed to submit timesheet', error);
      throw error;
    }
  }

  async generateContent(dayCount: number, maxChars: number, description: string): Promise<string[]> {
    const apiKey = this.configService.get<string>('SILICONFLOW_API_KEY');
    if (!apiKey) {
      throw new Error('SILICONFLOW_API_KEY is not configured');
    }

    try {
      const response = await axios.post(
        this.siliconFlowApiUrl,
        {
          model: 'Pro/zai-org/GLM-4.7',
          messages: [
            {
              role: 'system',
              content: `你是一个工时填报助手。根据用户描述的工作内容，生成${dayCount}条工作内容，每条不超过${maxChars}字。返回JSON数组格式：["内容1", "内容2", ...]`,
            },
            {
              role: 'user',
              content: description,
            },
          ],
        },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
        },
      );

      const content = response.data.choices[0].message.content;
      const parsed = JSON.parse(content);
      return parsed;
    } catch (error) {
      this.logger.error('Failed to generate content', error);
      throw error;
    }
  }

  async getProjects(token: string): Promise<ProjectDto[]> {
    const url = `${this.timesApiBaseUrl}/working/project/own-list`;
    const headers = this.getAuthHeaders(token);

    try {
      const response = await axios.get<ProjectDto[]>(url, { headers });
      return response.data;
    } catch (error) {
      this.logger.error('Failed to fetch projects', error);
      throw error;
    }
  }

  async getWorkTypes(projectId: string, token: string): Promise<WorkTypeDto[]> {
    const url = `${this.timesApiBaseUrl}/admin/working-config/tree?projectId=${projectId}`;
    const headers = this.getAuthHeaders(token);

    try {
      const response = await axios.get<WorkTypeDto[]>(url, { headers });
      return response.data;
    } catch (error) {
      this.logger.error('Failed to fetch work types', error);
      throw error;
    }
  }
}
