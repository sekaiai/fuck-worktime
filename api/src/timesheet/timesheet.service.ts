import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import { Agent } from 'https';
import { SubmitTimesheetDto } from './dto/submit-timesheet.dto';
import { ReportBatchDto } from './dto/report-batch.dto';
import { ReportDto } from './dto/report.dto';
import { ProjectDto } from './dto/project.dto';
import { WorkTypeDto } from './dto/work-type.dto';
import { AiService } from './ai/ai.service';

@Injectable()
export class TimesheetService {
  private readonly logger = new Logger(TimesheetService.name);
  private readonly timesApiBaseUrl = 'https://times.gzdata.com.cn:8099/prod-api';
  private readonly client: AxiosInstance = axios.create({
    timeout: 15000,
    httpsAgent: new Agent({ rejectUnauthorized: false }),
    insecureHTTPParser: true,
  });

  constructor(
    private readonly configService: ConfigService,
    private readonly aiService: AiService,
  ) {}

  private getAuthHeaders(token: string): { Authorization: string; Referer: string } {
    const normalized = this.normalizeToken(token);
    return {
      Authorization: `Bearer ${normalized}`,
      Referer: 'https://times.gzdata.com.cn:8099/hours/filling',
    };
  }

  private normalizeToken(token: string): string {
    const trimmed = token.trim().replace(/[\r\n]/g, '');
    return trimmed.startsWith('Bearer ') ? trimmed.slice(7).trim() : trimmed;
  }

  async submitTimesheet(data: SubmitTimesheetDto, token: string): Promise<unknown> {
    try {
      const response = await this.client.post(
        `${this.timesApiBaseUrl}/working/timing/report`,
        data,
        { headers: this.getAuthHeaders(token) },
      );
      return response.data;
    } catch (error) {
      this.logger.error('提交工时失败', error);
      throw error;
    }
  }

  async generateContent(work: string, days: number): Promise<string[]> {
    return this.aiService.generateWorkContents(work, days);
  }

  async getProjects(token: string): Promise<ProjectDto[]> {
    const url = `${this.timesApiBaseUrl}/working/project/own-list`;
    const headers = this.getAuthHeaders(token);

    try {
      const response = await this.client.get<ProjectDto[]>(url, { headers });
      return response.data;
    } catch (error) {
      this.logger.error('获取项目列表失败');
      throw error;
    }
  }

  async getWorkTypes(projectId: string, token: string): Promise<WorkTypeDto[]> {
    const url = `${this.timesApiBaseUrl}/admin/working-config/tree?projectId=${projectId}`;
    const headers = this.getAuthHeaders(token);

    try {
      const response = await this.client.get<WorkTypeDto[]>(url, { headers });
      return response.data;
    } catch (error) {
      this.logger.error('获取工时类型失败', error);
      throw error;
    }
  }

  async getWeekBoard(date: string, token: string): Promise<unknown> {
    const url = `${this.timesApiBaseUrl}/working/timing/week-board?date=${date}`;
    const headers = this.getAuthHeaders(token);

    try {
      const response = await this.client.get(url, { headers });
      return response.data;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`获取周工时看板失败：${message}`);
      throw error;
    }
  }

  async reportBatch(data: ReportBatchDto, token: string): Promise<unknown> {
    const url = `${this.timesApiBaseUrl}/working/timing/reportBatch`;
    const headers = this.getAuthHeaders(token);

    try {
      const response = await this.client.post(url, data, { headers });
      return response.data;
    } catch (error) {
      this.logger.error('批量提交工时失败', error);
      throw error;
    }
  }

  async report(data: ReportDto, token: string): Promise<unknown> {
    const url = `${this.timesApiBaseUrl}/working/timing/report`;
    const headers = this.getAuthHeaders(token);

    try {
      const response = await this.client.post(url, data, { headers });
      return response.data;
    } catch (error) {
      this.logger.error('提交单条工时失败', error);
      throw error;
    }
  }
}
