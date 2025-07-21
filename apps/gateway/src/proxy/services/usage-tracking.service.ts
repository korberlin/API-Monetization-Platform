import { Injectable } from '@nestjs/common';
import { UsageLog } from 'src/interfaces/usage.interface';
import { RedisService } from 'src/redis/redis.service';

@Injectable()
export class UsageTrackingService {
  private readonly MAX_LOGS_PER_CUSTOMER = 1000;
  private readonly MAX_LOGS_TOTAL = 5000;

  constructor(private redisService: RedisService) {}

  async addUsageLog(usage: UsageLog) {
    try {
      // Store in customer-specific list
      const customerKey = `usage:logs:${usage.customerId}`;
      await this.redisService.lpush(customerKey, JSON.stringify(usage));
      await this.redisService.ltrim(customerKey, 0, this.MAX_LOGS_PER_CUSTOMER - 1);

      // Store in global list
      await this.redisService.lpush('usage:logs:all', JSON.stringify(usage));
      await this.redisService.ltrim('usage:logs:all', 0, this.MAX_LOGS_TOTAL - 1);

      console.log('Usage tracked:', usage);
    } catch (error) {
      console.error('Failed to track usage:', error);
      // in production, add fallback to in-memory or queue for retry
    }
  }

  async getCustomerApiHistory(customerId: string): Promise<UsageLog[]> {
    try {
      const key = `usage:logs:${customerId}`;
      const logs = await this.redisService.lrange(key, 0, 99);
      return logs.map((log) => JSON.parse(log));
    } catch (error) {
      console.error('Failed to get customer usage logs:', error);
      return [];
    }
  }
}
