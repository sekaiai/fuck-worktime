import { Controller, Get, Headers, Query, Post, Body } from '@nestjs/common';
import { TimesheetService } from './timesheet.service';
import { ProjectDto } from './dto/project.dto';
import { WorkTypeDto } from './dto/work-type.dto';
import { SubmitTimesheetDto } from './dto/submit-timesheet.dto';
import { GenerateContentDto } from './dto/generate-content.dto';

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
}
