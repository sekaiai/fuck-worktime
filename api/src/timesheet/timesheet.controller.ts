import { Controller, Get, Headers, Query, Post, Body } from '@nestjs/common';
import { TimesheetService } from './timesheet.service';
import { ProjectDto } from './dto/project.dto';
import { WorkTypeDto } from './dto/work-type.dto';
import { SubmitTimesheetDto } from './dto/submit-timesheet.dto';
import { GenerateContentDto } from './dto/generate-content.dto';
import { ReportBatchDto } from './dto/report-batch.dto';
import { ReportDto } from './dto/report.dto';

@Controller('timesheet')
export class TimesheetController {
  constructor(private readonly timesheetService: TimesheetService) {}

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
    const maxChars = data.maxChars ?? 200;
    return this.timesheetService.generateContent(data.dayCount, maxChars, data.description);
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
}
