import { Module } from '@nestjs/common';

import { PushController } from './push.controller';
import { PushDeliveryService } from './push-delivery.service';

@Module({
  controllers: [PushController],
  providers: [PushDeliveryService],
  exports: [PushDeliveryService],
})
export class PushModule {}
