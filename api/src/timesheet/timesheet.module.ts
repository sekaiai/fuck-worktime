import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TimesheetController } from './timesheet.controller';
import { TimesheetService } from './timesheet.service';

@Module({
  imports: [ConfigModule],
  controllers: [TimesheetController],
  providers: [TimesheetService],
})
export class TimesheetModule {}
