import { Module } from '@nestjs/common';

import { TimesClient } from '../user/times.client';
import { DingtalkController } from './dingtalk.controller';
import { DingtalkPingScheduler } from './dingtalk-ping.scheduler';
import { DingtalkService } from './dingtalk.service';
import { DingtalkStore } from './dingtalk.store';

@Module({
  controllers: [DingtalkController],
  providers: [DingtalkService, DingtalkStore, DingtalkPingScheduler, TimesClient],
  exports: [DingtalkService, DingtalkStore],
})
export class DingtalkModule {}
