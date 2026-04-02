import { Injectable } from '@nestjs/common';
import axios, { AxiosError, AxiosInstance } from 'axios';
import { Agent } from 'https';

@Injectable()
export class TimesClient {
  private readonly client: AxiosInstance = axios.create({
    baseURL: 'https://times.gzdata.com.cn:8099',
    timeout: 15000,
    httpsAgent: new Agent({ rejectUnauthorized: false }),
    insecureHTTPParser: true,
    headers: {
      Accept: 'application/json, text/plain, */*',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      Referer: 'https://times.gzdata.com.cn:8099/hours/hours/timesheet',
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

      return response.data;
    } catch (error) {
      throw new Error(this.formatErrorMessage(error, '获取用户信息失败'));
    }
  }

  async ping(authorization: string): Promise<void> {
    try {
      await this.client.get('/prod-api/system/menu/website/ping', {
        headers: {
          Authorization: authorization,
        },
      });
    } catch (error) {
      throw new Error(this.formatErrorMessage(error, '心跳请求失败'));
    }
  }

  private formatErrorMessage(error: unknown, fallbackMessage: string) {
    if (axios.isAxiosError(error)) {
      return this.formatAxiosError(error, fallbackMessage);
    }

    if (error instanceof Error && error.message) {
      return error.message;
    }

    return fallbackMessage;
  }

  private formatAxiosError(error: AxiosError, fallbackMessage: string) {
    const status = error.response?.status;
    const responseData = error.response?.data;

    if (typeof responseData === 'string' && responseData.trim()) {
      return status ? `${fallbackMessage}（HTTP ${status}）：${responseData}` : responseData;
    }

    if (responseData && typeof responseData === 'object') {
      const maybeMessage = (responseData as { msg?: unknown; message?: unknown }).msg;
      const fallbackField = (responseData as { msg?: unknown; message?: unknown }).message;
      const serverMessage =
        typeof maybeMessage === 'string'
          ? maybeMessage
          : typeof fallbackField === 'string'
            ? fallbackField
            : null;

      if (serverMessage) {
        return status
          ? `${fallbackMessage}（HTTP ${status}）：${serverMessage}`
          : `${fallbackMessage}：${serverMessage}`;
      }
    }

    if (error.message) {
      return status ? `${fallbackMessage}（HTTP ${status}）：${error.message}` : error.message;
    }

    return fallbackMessage;
  }
}
