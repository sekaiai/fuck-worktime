import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import { Agent } from 'https';
import { SubmitTimesheetDto } from './dto/submit-timesheet.dto';
import { ReportBatchDto } from './dto/report-batch.dto';
import type { ReportBatchResponse } from './dto/report-batch.dto';
import { ReportDto } from './dto/report.dto';
import { UpdateReportDto } from './dto/update-report.dto';
import { ProjectDto } from './dto/project.dto';
import { WorkTypeDto } from './dto/work-type.dto';
import { AiService } from './ai/ai.service';
import type { PreviousWeekContentDto } from './dto/generate-content.dto';

@Injectable()
export class TimesheetService {
  private readonly logger = new Logger(TimesheetService.name);
  private readonly timesApiBaseUrl = 'https://times.gzbdgc.com.cn:8099/prod-api';
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
      Referer: 'https://times.gzbdgc.com.cn:8099/hours/filling',
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

  async generateContent(
    work: string,
    days: number,
    lastWeekContents?: PreviousWeekContentDto[],
    targetWeekdays?: string[],
  ): Promise<string[]> {
    if (lastWeekContents || targetWeekdays) {
      if (!lastWeekContents || !targetWeekdays || targetWeekdays.length !== days) {
        throw new BadRequestException('上周参考内容与目标星期必须完整且数量一致');
      }

      return this.aiService.generateWorkContentsFromLastWeek(lastWeekContents, targetWeekdays);
    }

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

  async reportBatch(data: ReportBatchDto, token: string): Promise<ReportBatchResponse> {
    const url = `${this.timesApiBaseUrl}/working/timing/reportBatch`;
    const headers = this.getAuthHeaders(token);

    try {
      const response = await this.client.post<unknown>(url, data, { headers });
      return this.normalizeReportBatchResponse(response.data, response.status);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`批量提交工时失败：${message}`);
      return this.normalizeReportBatchError(error);
    }
  }

  private async postReport(
    data: unknown,
    token: string,
  ): Promise<{ payload: unknown; status: number }> {
    const url = `${this.timesApiBaseUrl}/working/timing/report`;
    const headers = this.getAuthHeaders(token);
    const response = await this.client.post<unknown>(url, data, { headers });
    return { payload: response.data, status: response.status };
  }

  private normalizeReportBatchResponse(payload: unknown, status: number): ReportBatchResponse {
    const record = this.isRecord(payload) ? payload : null;
    const isHttpError = status < 200 || status >= 300;
    const code = isHttpError
      ? status
      : typeof record?.code === 'number'
        ? record.code
        : 200;
    const msg = this.getResponseMessage(record?.msg, record?.message, record?.currentMessage) ||
      (this.isReportSuccessCode(code) ? '提交成功' : `批量提交失败（${code}）`);
    const data = record && 'data' in record ? record.data ?? null : payload ?? null;

    return { code, msg, data };
  }

  private normalizeReportBatchError(error: unknown): ReportBatchResponse {
    if (axios.isAxiosError(error)) {
      const isTimeout = error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT';
      if (isTimeout) {
        return {
          code: 504,
          msg: '批量提交工时请求超时，请稍后重试。',
          data: null,
        };
      }

      if (!error.response) {
        return {
          code: 502,
          msg: '无法连接 gzbdgc 上游，请稍后重试。',
          data: null,
        };
      }

      const status = error.response?.status ?? 502;
      return this.normalizeReportBatchResponse(
        error.response?.data ?? null,
        status,
      );
    }

    return {
      code: 502,
      msg: '提交工时失败，请稍后重试。',
      data: null,
    };
  }

  private isReportSuccessCode(code: number): boolean {
    return code === 200 || code === 0;
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  private getResponseMessage(...values: unknown[]): string {
    for (const value of values) {
      if (typeof value === 'string' && value.trim()) {
        return value;
      }
    }

    return '';
  }

  async report(data: ReportDto, token: string): Promise<unknown> {
    try {
      const response = await this.postReport(data, token);
      return response.payload;
    } catch (error) {
      this.logger.error('提交单条工时失败', error);
      throw error;
    }
  }

  async updateReport(token: string, id: string, dto: UpdateReportDto): Promise<unknown> {
    const url = `${this.timesApiBaseUrl}/working/timing/report/${encodeURIComponent(id)}`;
    const response = await this.client.put(url, { ...dto, id }, { headers: this.getAuthHeaders(token) });
    return response.data;
  }

  async deleteReport(token: string, id: string): Promise<unknown> {
    const url = `${this.timesApiBaseUrl}/working/timing/report/${encodeURIComponent(id)}`;
    const response = await this.client.delete(url, { headers: this.getAuthHeaders(token) });
    return response.data;
  }
}
