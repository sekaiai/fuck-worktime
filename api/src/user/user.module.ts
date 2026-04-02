import { Module } from '@nestjs/common';

import { PingScheduler } from './ping.scheduler';
import { TimesClient } from './times.client';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { UserStore } from './user.store';

@Module({
  controllers: [UserController],
  providers: [UserService, UserStore, TimesClient, PingScheduler],
})
export class UserModule {}
