import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as webpush from 'web-push';

import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { StoredSubscription } from './push.types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ProxyAgent = any;

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private readonly subscriptions = new Map<string, StoredSubscription>();
  private readonly requestTimeoutMs = 30000;
  private readonly proxyAgent: ProxyAgent | undefined;

  constructor(private readonly configService: ConfigService) {
    const subject = this.configService.get<string>('VAPID_SUBJECT');
    const publicKey = this.configService.get<string>('VAPID_PUBLIC_KEY');
    const privateKey = this.configService.get<string>('VAPID_PRIVATE_KEY');

    // 配置代理
    const proxyUrl = process.env.https_proxy || process.env.HTTPS_PROXY;
    if (proxyUrl) {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { HttpsProxyAgent } = require('https-proxy-agent');
      this.proxyAgent = new HttpsProxyAgent(proxyUrl);
      this.logger.log(`使用代理: ${proxyUrl}`);
    }

    if (subject && publicKey && privateKey) {
      webpush.setVapidDetails(subject, publicKey, privateKey);
    } else {
      this.logger.warn('VAPID keys are not configured. Push sending is disabled.');
    }
  }

  getPublicKey() {
    return {
      publicKey: this.configService.get<string>('VAPID_PUBLIC_KEY') ?? '',
    };
  }

  saveSubscription(subscription: CreateSubscriptionDto) {
    this.subscriptions.set(subscription.endpoint, subscription);

    return {
      success: true,
      count: this.subscriptions.size,
    };
  }

  listSubscriptions() {
    return Array.from(this.subscriptions.values());
  }

  getDiagnosticInfo() {
    const subscriptions = Array.from(this.subscriptions.values());
    const endpointParts = subscriptions.map((sub) => {
      try {
        const url = new URL(sub.endpoint);
        return {
          origin: url.origin,
          pathname: url.pathname,
          protocol: url.protocol,
        };
      } catch {
        return { raw: sub.endpoint };
      }
    });

    return {
      vapidConfigured: !!(
        this.configService.get<string>('VAPID_SUBJECT') &&
        this.configService.get<string>('VAPID_PUBLIC_KEY') &&
        this.configService.get<string>('VAPID_PRIVATE_KEY')
      ),
      vapidSubject: this.configService.get<string>('VAPID_SUBJECT') ?? '',
      subscriptionCount: subscriptions.length,
      endpointOrigins: endpointParts,
      requestTimeoutMs: this.requestTimeoutMs,
    };
  }

  async sendTestNotification(payload?: {
    title?: string;
    body?: string;
    url?: string;
  }) {
    const subscriptions = Array.from(this.subscriptions.values());

    // 记录订阅信息用于调试
    this.logger.debug(`准备发送推送，订阅数量: ${subscriptions.length}`);
    subscriptions.forEach((sub, index) => {
      this.logger.debug(`订阅[${index}]: endpoint=${sub.endpoint.substring(0, 50)}...`);
    });

    const pushPayload = JSON.stringify({
      title: payload?.title ?? '云上工时',
      body: payload?.body ?? '这是一条测试通知。',
      url: payload?.url ?? '/',
    });

    const results = await Promise.allSettled(
      subscriptions.map((subscription) => {
        const options: webpush.RequestOptions = {
          timeout: this.requestTimeoutMs,
          TTL: 60,
          urgency: 'high',
        };
        // 如果有代理，添加 agent
        if (this.proxyAgent) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (options as any).agent = this.proxyAgent;
        }
        return webpush.sendNotification(subscription as webpush.PushSubscription, pushPayload, options);
      }),
    );

    let removed = 0;
    const errors: string[] = [];
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        const reason = result.reason as Partial<webpush.WebPushError> | undefined;
        const reasonText =
          reason && typeof reason === 'object'
            ? `status=${String(reason.statusCode ?? 'unknown')}, message=${String(reason.message ?? 'unknown')}`
            : String(result.reason);
        errors.push(`subscription[${index}]: ${reasonText}`);

        // 清理无效订阅：404/410 表示订阅已过期
        if (reason?.statusCode === 404 || reason?.statusCode === 410) {
          const endpoint = subscriptions[index]?.endpoint;
          if (endpoint && this.subscriptions.delete(endpoint)) {
            removed += 1;
          }
        }

        this.logger.warn(
          `Push delivery failed for subscription ${index}: ${String(result.reason)}`,
        );
      }
    });

    const attempted = subscriptions.length;
    const delivered = results.filter((result) => result.status === 'fulfilled').length;
    const failed = results.filter((result) => result.status === 'rejected').length;
    const success = attempted > 0 && delivered > 0;

    let resultMessage = '推送已送达。';
    if (attempted === 0) {
      resultMessage = '当前没有可用订阅，请先创建订阅。';
    } else if (delivered === 0) {
      resultMessage = '推送请求已发出，但未送达任何订阅。请检查网络连接或重新创建订阅。';
    }

    return {
      success,
      message: resultMessage,
      attempted,
      delivered,
      failed,
      removed,
      errors,
    };
  }
}
