import { Body, Controller, Get, Post, Delete } from '@nestjs/common';

import { RegisterDeviceDto } from './dto/register-device.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { PushService } from './push.service';

@Controller('push')
export class PushController {
  constructor(private readonly pushService: PushService) {}

  @Post('register')
  register(@Body() dto: RegisterDeviceDto) {
    return this.pushService.registerDevice(dto.cid, dto.platform, dto.userId);
  }

  @Delete('register/:cid')
  unregister(cid: string) {
    return this.pushService.unregisterDevice(cid);
  }

  @Get('registrations')
  listRegistrations() {
    return this.pushService.listRegistrations();
  }

  @Post('send')
  sendMessage(@Body() dto: SendMessageDto) {
    return this.pushService.sendMessage({
      title: dto.title,
      content: dto.content,
      payload: dto.payload,
      cids: dto.cids,
    });
  }

  @Get('diagnostic')
  getDiagnostic() {
    return this.pushService.getDiagnosticInfo();
  }
}
