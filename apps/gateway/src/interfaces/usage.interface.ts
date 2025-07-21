export interface UsageLog {
  customerId: string;
  apiKey: string;
  apiKeyId: number;
  endpoint: string;
  method: string;
  statusCode: string;
  responseTime: number;
  timestamp: Date;
}

export interface UsageMap {
  count: string;
  resetAt: string;
}
