import { Module } from '@nestjs/common';

import { DingtalkController } from './dingtalk.controller';
import { DingtalkService } from './dingtalk.service';
import { DingtalkStore } from './dingtalk.store';

@Module({
  controllers: [DingtalkController],
  providers: [DingtalkService, DingtalkStore],
})
export class DingtalkModule {}
