import { Injectable } from '@nestjs/common';
import axios, { AxiosError, AxiosInstance } from 'axios';
import { Agent } from 'https';

export class TimesClientError extends Error {
  constructor(
    message: string,
    readonly statusCode?: number,
    readonly responseData?: unknown,
  ) {
    super(message);
  }
}

export interface TimesPingResult {
  statusCode: number;
  data: unknown;
}

@Injectable()
export class TimesClient {
  private readonly client: AxiosInstance = axios.create({
    baseURL: 'https://times.gzbdgc.com.cn:8099',
    timeout: 15000,
    httpsAgent: new Agent({ rejectUnauthorized: false }),
    insecureHTTPParser: true,
    headers: {
      Accept: 'application/json, text/plain, */*',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      Referer: 'https://times.gzbdgc.com.cn:8099/hours/hours/timesheet',
      'Sec-Fetch-Site': 'same-origin',
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36',
      'sec-ch-ua': '"Not(A:Brand";v="8", "Chromium";v="144", "Google Chrome";v="144"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"macOS"',
    },
  });

  async getUserInfo(authorization: string): Promise<unknown> {
    try {
      const response = await this.client.get('/prod-api/getInfo', {
        headers: {
          Authorization: authorization,
        },
      });

      const responseRecord = this.asRecord(response.data);
      if (typeof responseRecord?.code === 'number' && ![0, 200].includes(responseRecord.code)) {
        const message = this.getResponseMessage(responseRecord) ?? `获取用户信息失败（code=${responseRecord.code}）`;
        throw new TimesClientError(message, response.status, response.data);
      }

      return response.data;
    } catch (error) {
      throw this.createClientError(error, '获取用户信息失败');
    }
  }

  async ping(authorization: string): Promise<TimesPingResult> {
    try {
      const response = await this.client.get('/prod-api/system/menu/website/ping', {
        headers: {
          Authorization: authorization,
        },
      });

      const responseRecord = this.asRecord(response.data);
      if (typeof responseRecord?.code === 'number' && ![0, 200].includes(responseRecord.code)) {
        const message = this.getResponseMessage(responseRecord) ?? `心跳业务失败（code=${responseRecord.code}）`;
        throw new TimesClientError(message, response.status, response.data);
      }

      return {
        statusCode: response.status,
        data: response.data,
      };
    } catch (error) {
      throw this.createClientError(error, '心跳请求失败');
    }
  }

  private createClientError(error: unknown, fallbackMessage: string): TimesClientError {
    if (error instanceof TimesClientError) {
      return error;
    }

    if (axios.isAxiosError(error)) {
      return this.formatAxiosError(error, fallbackMessage);
    }

    if (error instanceof Error && error.message) {
      return new TimesClientError(fallbackMessage);
    }

    return new TimesClientError(fallbackMessage);
  }

  private formatAxiosError(error: AxiosError, fallbackMessage: string): TimesClientError {
    const status = error.response?.status;
    const responseData = error.response?.data;

    if (typeof responseData === 'string' && responseData.trim()) {
      return new TimesClientError(
        status ? `${fallbackMessage}（HTTP ${status}）` : fallbackMessage,
        status,
        responseData,
      );
    }

    if (responseData && typeof responseData === 'object') {
      return new TimesClientError(
        status ? `${fallbackMessage}（HTTP ${status}）` : fallbackMessage,
        status,
        responseData,
      );
    }

    if (error.message) {
      return new TimesClientError(
        status ? `${fallbackMessage}（HTTP ${status}）` : fallbackMessage,
        status,
        responseData,
      );
    }

    return new TimesClientError(fallbackMessage, status, responseData);
  }

  private asRecord(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }

    return value as Record<string, unknown>;
  }

  private getResponseMessage(record: Record<string, unknown>): string | null {
    for (const key of ['msg', 'message']) {
      const value = record[key];
      if (typeof value === 'string' && value.trim()) {
        return value.trim();
      }
    }

    return null;
  }
}
