export interface PushRegistration {
  cid: string;
  userId?: string;
  platform: 'android' | 'ios' | 'web';
  createdAt: Date;
}

export interface PushMessage {
  title: string;
  content: string;
  payload?: Record<string, unknown>;
  cids?: string[];
}

export interface PushResult {
  success: boolean;
  message: string;
  attempted: number;
  delivered: number;
  failed: number;
  errors: string[];
}

export interface DiagnosticInfo {
  configured: boolean;
  appId: string;
  registrationCount: number;
  platforms: Record<string, number>;
  requestTimeoutMs: number;
}
