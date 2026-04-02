import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class TimesheetService {
  private readonly logger = new Logger(TimesheetService.name);
  private readonly timesApiBaseUrl = 'https://times.gzdata.com.cn:8099/prod-api';

  constructor(private readonly configService: ConfigService) {}

  private getAuthHeaders(token: string) {
    return {
      Authorization: `Bearer ${token}`,
      Referer: 'https://times.gzdata.com.cn:8099/hours/filling',
    };
  }
}
