import { Body, Controller, Delete, Get, Post, Query } from '@nestjs/common';

import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { RemoveSubscriptionDto } from './dto/remove-subscription.dto';
import { SendNotificationDto } from './dto/send-notification.dto';
import { PushDeliveryService } from './push-delivery.service';

@Controller('push')
export class PushController {
  constructor(private readonly pushService: PushDeliveryService) {}

  @Get('public-key')
  getPublicKey() {
    return this.pushService.getPublicKey();
  }

  @Get('subscriptions')
  getSubscriptions(@Query('userId') userId?: string) {
    return this.pushService.listSubscriptions(userId);
  }

  @Get('diagnostic')
  getDiagnostic() {
    return this.pushService.getDiagnosticInfo();
  }

  @Post('subscribe')
  subscribe(@Body() subscription: CreateSubscriptionDto) {
    return this.pushService.saveSubscription(subscription);
  }

  @Delete('subscribe')
  unsubscribe(@Query() query: RemoveSubscriptionDto) {
    return this.pushService.removeSubscription(query.endpoint);
  }

  @Post('test')
  sendTest(@Body() payload: SendNotificationDto) {
    return this.pushService.sendTestNotification(payload);
  }
}
