import { Controller, Get, Headers, Query, Post, Body, Delete } from '@nestjs/common';
import { TimesheetService } from './timesheet.service';
import { ProjectDto } from './dto/project.dto';
import { WorkTypeDto } from './dto/work-type.dto';
import { SubmitTimesheetDto } from './dto/submit-timesheet.dto';
import { GenerateContentDto } from './dto/generate-content.dto';
import { ReportBatchDto } from './dto/report-batch.dto';
import { ReportDto } from './dto/report.dto';
import { SaveAutoFillDto, GetAutoFillQueryDto } from './dto/auto-fill.dto';
import { AutoFillStore } from './scheduler/auto-fill.store';
import type { AutoFillConfig } from './scheduler/auto-fill.types';

@Controller('timesheet')
export class TimesheetController {
  constructor(
    private readonly timesheetService: TimesheetService,
    private readonly autoFillStore: AutoFillStore,
  ) {}

  @Get('projects')
  async getProjects(
    @Headers('x-gzdata-token') token: string,
  ): Promise<ProjectDto[]> {
    return this.timesheetService.getProjects(token);
  }

  @Get('work-types')
  async getWorkTypes(
    @Query('projectId') projectId: string,
    @Headers('x-gzdata-token') token: string,
  ): Promise<WorkTypeDto[]> {
    return this.timesheetService.getWorkTypes(projectId, token);
  }

  @Post('submit')
  async submitTimesheet(
    @Body() data: SubmitTimesheetDto,
    @Headers('x-gzdata-token') token: string,
  ): Promise<unknown> {
    return this.timesheetService.submitTimesheet(data, token);
  }

  @Post('generate')
  async generateContent(
    @Body() data: GenerateContentDto,
  ): Promise<string[]> {
    return this.timesheetService.generateContent(data.work, data.days);
  }

  @Get('week-board')
  async getWeekBoard(
    @Query('date') date: string,
    @Headers('x-gzdata-token') token: string,
  ): Promise<unknown> {
    return this.timesheetService.getWeekBoard(date, token);
  }

  @Post('report-batch')
  async reportBatch(
    @Body() data: ReportBatchDto,
    @Headers('x-gzdata-token') token: string,
  ): Promise<unknown> {
    return this.timesheetService.reportBatch(data, token);
  }

  @Post('report')
  async report(
    @Body() data: ReportDto,
    @Headers('x-gzdata-token') token: string,
  ): Promise<unknown> {
    return this.timesheetService.report(data, token);
  }

  @Post('auto-fill')
  saveAutoFill(@Body() dto: SaveAutoFillDto): { code: number; msg: string; data: AutoFillConfig | null } {
    const existing = this.autoFillStore.get(dto.userId);
    const config: AutoFillConfig = {
      userId: dto.userId,
      enabled: dto.enabled ?? true,
      expired: false,
      projectId: dto.projectId,
      projectTitle: dto.projectTitle,
      projectStatus: dto.projectStatus,
      itemId: dto.itemId,
      itemName: dto.itemName,
      hours: dto.hours,
      work: dto.work,
      deadline: dto.deadline ?? null,
      lastExecutedAt: existing?.lastExecutedAt ?? null,
      lastExecutionStatus: existing?.lastExecutionStatus ?? null,
    };
    this.autoFillStore.set(config);
    return { code: 200, msg: '保存成功', data: config };
  }

  @Get('auto-fill')
  getAutoFill(@Query() query: GetAutoFillQueryDto): { code: number; msg: string; data: AutoFillConfig | null } {
    const config = this.autoFillStore.get(query.userId);
    return { code: 200, msg: 'success', data: config };
  }

  @Delete('auto-fill')
  disableAutoFill(@Query() query: GetAutoFillQueryDto): { code: number; msg: string; data: AutoFillConfig | null } {
    const config = this.autoFillStore.get(query.userId);
    if (!config) {
      return { code: 404, msg: '配置不存在', data: null };
    }
    const updated: AutoFillConfig = { ...config, enabled: false };
    this.autoFillStore.set(updated);
    return { code: 200, msg: '已关闭自动填报', data: updated };
  }
}
