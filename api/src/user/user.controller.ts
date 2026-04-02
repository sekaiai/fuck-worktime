import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';

import { SaveAuthDto } from './dto/save-auth.dto';
import { UserService } from './user.service';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post('save-auth')
  saveAuth(@Body() dto: SaveAuthDto) {
    return this.userService.saveAuth(dto);
  }

  @Get('profile')
  getUserProfile(@Query('phone') phone: string) {
    return this.userService.getUserByPhone(phone ?? '');
  }

  @Delete('auth/:phone')
  clearAuth(@Param('phone') phone: string) {
    return this.userService.clearAuthByPhone(phone);
  }
}
