import { Module } from '@nestjs/common';

import { UserModule } from '../user/user.module';

import { DingtalkController } from './dingtalk.controller';
import { DingtalkService } from './dingtalk.service';

@Module({
  imports: [UserModule],
  controllers: [DingtalkController],
  providers: [DingtalkService],
})
export class DingtalkModule {}
