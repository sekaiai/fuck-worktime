import { Controller, Get, Query } from '@nestjs/common';

import { GetUserByPhoneQueryDto, GetUserQueryDto } from './dto/user-info.dto';
import { DingtalkService } from './dingtalk.service';

@Controller('dingtalk')
export class DingtalkController {
  constructor(private readonly dingtalkService: DingtalkService) {}

  @Get('qrcode')
  async getQrcode(@Query('userId') userId?: string) {
    try {
      const result = await this.dingtalkService.getQrcode(userId);
      return { code: 200, msg: 'success', data: result };
    } catch (error) {
      return {
        code: 500,
        msg: error instanceof Error ? error.message : '获取二维码失败',
        data: null,
      };
    }
  }

  @Get('status')
  getStatus(@Query('taskId') taskId: string) {
    if (!taskId) {
      return { code: 400, msg: 'taskId is required', data: null };
    }
    const result = this.dingtalkService.getStatus(taskId);
    return { code: 200, msg: 'success', data: result };
  }

  @Get('user')
  async getUser(@Query() dto: GetUserQueryDto) {
    try {
      const result = await this.dingtalkService.getUserByUserId(dto.userId);
      if (!result) {
        return { code: 404, msg: '用户不存在', data: null };
      }
      return { code: 200, msg: 'success', data: result };
    } catch (error) {
      return {
        code: 500,
        msg: error instanceof Error ? error.message : '获取用户信息失败',
        data: null,
      };
    }
  }

  @Get('user-by-phone')
  async getUserByPhone(@Query() dto: GetUserByPhoneQueryDto) {
    try {
      const result = await this.dingtalkService.getUserByPhone(dto.phone);
      if (!result) {
        return { code: 404, msg: '未找到对应手机号的登录数据', data: null };
      }
      return { code: 200, msg: 'success', data: result };
    } catch (error) {
      return {
        code: 500,
        msg: error instanceof Error ? error.message : '根据手机号获取用户信息失败',
        data: null,
      };
    }
  }
}
