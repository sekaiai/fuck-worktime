import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
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

  constructor(
    private readonly configService: ConfigService,
    private readonly aiService: AiService,
  ) {}

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
        { headers: this.getAuthHeaders(token) },
      );
      return response.data;
    } catch (error) {
      this.logger.error('Failed to submit timesheet', error);
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
      const response = await axios.get<ProjectDto[]>(url, { headers });
      return response.data;
    } catch (error) {
      this.logger.error('Failed to fetch projects');
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

  async getWeekBoard(date: string, token: string): Promise<unknown> {
    const url = `${this.timesApiBaseUrl}/working/timing/week-board?date=${date}`;
    const headers = this.getAuthHeaders(token);

    try {
      const response = await axios.get(url, { headers });
      return response.data;
    } catch (error) {
      this.logger.error('Failed to fetch week board', error);
      throw error;
    }
  }

  async reportBatch(data: ReportBatchDto, token: string): Promise<unknown> {
    const url = `${this.timesApiBaseUrl}/working/timing/reportBatch`;
    const headers = this.getAuthHeaders(token);

    try {
      const response = await axios.post(url, data, { headers });
      return response.data;
    } catch (error) {
      this.logger.error('Failed to batch report timesheet', error);
      throw error;
    }
  }

  async report(data: ReportDto, token: string): Promise<unknown> {
    const url = `${this.timesApiBaseUrl}/working/timing/report`;
    const headers = this.getAuthHeaders(token);

    try {
      const response = await axios.post(url, data, { headers });
      return response.data;
    } catch (error) {
      this.logger.error('Failed to report timesheet', error);
      throw error;
    }
  }
}
