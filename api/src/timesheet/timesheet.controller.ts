import { Controller, Get, Headers, Query } from '@nestjs/common';
import { TimesheetService } from './timesheet.service';
import { ProjectDto } from './dto/project.dto';
import { WorkTypeDto } from './dto/work-type.dto';

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
}
