import { Body, Controller, Post } from '@nestjs/common';

import { SaveAuthDto } from './dto/save-auth.dto';
import { UserService } from './user.service';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post('save-auth')
  saveAuth(@Body() dto: SaveAuthDto) {
    return this.userService.saveAuth(dto);
  }
}
