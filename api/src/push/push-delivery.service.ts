import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as webpush from 'web-push';

import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { StoredSubscription } from './push.types';

interface NotificationPayload {
  title?: string;
  body?: string;
  url?: string;
}

@Injectable()
export class PushDeliveryService {
  private readonly logger = new Logger(PushDeliveryService.name);
  private readonly subscriptions = new Map<string, StoredSubscription>();
  private readonly requestTimeoutMs = 30000;

  constructor(private readonly configService: ConfigService) {
    const subject = this.configService.get<string>('VAPID_SUBJECT');
    const publicKey = this.configService.get<string>('VAPID_PUBLIC_KEY');
    const privateKey = this.configService.get<string>('VAPID_PRIVATE_KEY');

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

  removeSubscription(endpoint: string) {
    const removed = this.subscriptions.delete(endpoint);

    return {
      success: removed,
      count: this.subscriptions.size,
    };
  }

  listSubscriptions(userId?: string) {
    const subscriptions = Array.from(this.subscriptions.values());

    if (!userId) {
      return subscriptions;
    }

    return subscriptions.filter((subscription) => subscription.userId === userId);
  }

  getDiagnosticInfo() {
    const subscriptions = Array.from(this.subscriptions.values());
    const endpointParts = subscriptions.map((subscription) => {
      try {
        const url = new URL(subscription.endpoint);
        return {
          origin: url.origin,
          pathname: url.pathname,
          protocol: url.protocol,
          userId: subscription.userId,
        };
      } catch {
        return { raw: subscription.endpoint, userId: subscription.userId };
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

  async sendTestNotification(payload?: NotificationPayload) {
    return this.sendNotificationToAll(payload);
  }

  async sendNotificationToUser(userId: string, payload?: NotificationPayload) {
    const subscriptions = Array.from(this.subscriptions.values()).filter(
      (subscription) => subscription.userId === userId,
    );

    return this.sendNotification(payload, subscriptions);
  }

  async sendNotificationToAll(payload?: NotificationPayload) {
    return this.sendNotification(payload, Array.from(this.subscriptions.values()));
  }

  private async sendNotification(
    payload: NotificationPayload | undefined,
    subscriptions: StoredSubscription[],
  ) {
    this.logger.debug(`Preparing push delivery for ${subscriptions.length} subscriptions.`);

    const pushPayload = JSON.stringify({
      title: payload?.title ?? '云上工时',
      body: payload?.body ?? '这是一条测试通知。',
      url: payload?.url ?? '/',
    });

    const results = await Promise.allSettled(
      subscriptions.map((subscription) =>
        webpush.sendNotification(subscription as webpush.PushSubscription, pushPayload, {
          timeout: this.requestTimeoutMs,
          TTL: 60,
          urgency: 'high',
        }),
      ),
    );

    let removed = 0;
    const errors: string[] = [];

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        return;
      }

      const reason = result.reason as Partial<webpush.WebPushError> | undefined;
      const reasonText =
        reason && typeof reason === 'object'
          ? `status=${String(reason.statusCode ?? 'unknown')}, message=${String(reason.message ?? 'unknown')}`
          : String(result.reason);

      errors.push(`subscription[${index}]: ${reasonText}`);

      if (reason?.statusCode === 404 || reason?.statusCode === 410) {
        const endpoint = subscriptions[index]?.endpoint;
        if (endpoint && this.subscriptions.delete(endpoint)) {
          removed += 1;
        }
      }

      this.logger.warn(`Push delivery failed for subscription ${index}: ${reasonText}`);
    });

    const attempted = subscriptions.length;
    const delivered = results.filter((result) => result.status === 'fulfilled').length;
    const failed = results.filter((result) => result.status === 'rejected').length;
    const success = attempted > 0 && delivered > 0;

    let message =
      '推送请求已发送，是否展示系统通知取决于浏览器权限、Service Worker 和系统通知设置。';
    if (attempted === 0) {
      message = '当前没有可用订阅，请先创建订阅。';
    } else if (delivered === 0) {
      message = '推送请求已发出，但未送达任何订阅，请检查权限或重新订阅。';
    }

    return {
      success,
      message,
      attempted,
      delivered,
      failed,
      removed,
      errors,
    };
  }
}
