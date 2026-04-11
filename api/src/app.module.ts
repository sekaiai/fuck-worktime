import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { HealthModule } from './health/health.module';
import { DingtalkModule } from './dingtalk/dingtalk.module';
import { PushModule } from './push/push.module';
import { TimesheetModule } from './timesheet/timesheet.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    HealthModule,
    DingtalkModule,
    PushModule,
    TimesheetModule,
  ],
})
export class AppModule {}
