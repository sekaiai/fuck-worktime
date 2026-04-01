import { Body, Controller, Get, Post } from '@nestjs/common';

import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { SendNotificationDto } from './dto/send-notification.dto';
import { PushService } from './push.service';

@Controller('push')
export class PushController {
  constructor(private readonly pushService: PushService) {}

  @Get('public-key')
  getPublicKey() {
    return this.pushService.getPublicKey();
  }

  @Get('subscriptions')
  getSubscriptions() {
    return this.pushService.listSubscriptions();
  }

  @Get('diagnostic')
  getDiagnostic() {
    return this.pushService.getDiagnosticInfo();
  }

  @Post('subscribe')
  subscribe(@Body() subscription: CreateSubscriptionDto) {
    return this.pushService.saveSubscription(subscription);
  }

  @Post('test')
  sendTest(@Body() payload: SendNotificationDto) {
    return this.pushService.sendTestNotification(payload);
  }
}

