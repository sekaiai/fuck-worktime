import { Module } from '@nestjs/common';

import { TimesClient } from '../user/times.client';
import { DingtalkController } from './dingtalk.controller';
import { DingtalkService } from './dingtalk.service';
import { DingtalkStore } from './dingtalk.store';

@Module({
  controllers: [DingtalkController],
  providers: [DingtalkService, DingtalkStore, TimesClient],
  exports: [DingtalkService],
})
export class DingtalkModule {}
