import { Injectable } from '@nestjs/common';
import { RedisService } from 'src/redis/redis.service';
@Injectable()
export class RateLimitService {
  constructor(private redisService: RedisService) {}

  async checkAndIncrement(
    customerId: string,
    limit: number,
  ): Promise<{
    allowed: boolean;
    remaining: number;
    resetAt: string;
  }> {
    const now = new Date();
    const userUsage = await this.redisService.hgetAll(`rate:limit:${customerId}`);

    // reset if new day
    if (!userUsage || Object.keys(userUsage).length === 0) {
      const resetAt = new Date();
      resetAt.setHours(24, 0, 0, 0); // reset at midnight

      await this.redisService.hset(`rate:limit:${customerId}`, 'count', 1);
      await this.redisService.hset(`rate:limit:${customerId}`, 'resetAt', resetAt);
      return {
        allowed: true,
        remaining: limit - 1,
        resetAt: resetAt.toDateString(),
      };
    }
    let resetAt = new Date(userUsage.resetAt);
    if (resetAt < now) {
      resetAt = new Date();
      resetAt.setHours(24, 0, 0, 0); // reset at midnight

      await this.redisService.hset(`rate:limit:${customerId}`, 'count', 1);
      await this.redisService.hset(`rate:limit:${customerId}`, 'resetAt', resetAt);
      return {
        allowed: true,
        remaining: limit - 1,
        resetAt: resetAt.toDateString(),
      };
    }
    // check limit
    const usageCount = parseInt(userUsage.count);
    if (usageCount >= limit) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: userUsage.resetAt,
      };
    }
    // increment usage
    await this.redisService.hset(`rate:limit:${customerId}`, 'count', usageCount + 1);
    return {
      allowed: true,
      remaining: limit - usageCount,
      resetAt: userUsage.resetAt,
    };
  }

  async getCustomerRateLimit(customerId: string) {
    return this.redisService.hgetAll(`rate:limit:${customerId}`);
  }

  async getAllStats() {
    try {
      const keys = await this.redisService.keys('rate:limit:*');
      // fetch each one
      const stats: Record<string, any> = {};
      for (const key of keys) {
        const data = await this.redisService.hgetAll(key);
        const customerId = key.replace('rate:limit:', '');
        stats[customerId] = {
          count: parseInt(data.count),
          resetAt: data.resetAt,
        };
      }
      return stats;
    } catch (error) {
      console.error('An error occured while fetching data', error);
    }
  }
}
