import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { TimesheetController } from './timesheet.controller';
import { TimesheetService } from './timesheet.service';
import { AiService } from './ai/ai.service';
import { AutoFillStore } from './scheduler/auto-fill.store';
import { AutoFillScheduler } from './scheduler/auto-fill.scheduler';
import { DingtalkModule } from '../dingtalk/dingtalk.module';
import { PushModule } from '../push/push.module';

@Module({
  imports: [ConfigModule, ScheduleModule.forRoot(), DingtalkModule, PushModule],
  controllers: [TimesheetController],
  providers: [TimesheetService, AiService, AutoFillStore, AutoFillScheduler],
  exports: [TimesheetService, AiService, AutoFillStore],
})
export class TimesheetModule {}
