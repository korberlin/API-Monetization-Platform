import { RedisService } from 'src/redis/redis.service';
import { Injectable } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class JobsService {
  constructor(
    private prismaService: PrismaService,
    private redisService: RedisService,
  ) {}

  @Interval(30000)
  async flushToDb() {
    try {
      const lastUsages = await this.redisService.lrange('usage:logs:all', 0, 99);
      if (lastUsages.length === 0) {
        return;
      }
      const usageData = lastUsages.map((usageItem) => {
        const usage = JSON.parse(usageItem);
        return {
          customerId: usage.customerId,
          endpoint: usage.endpoint,
          apiKeyId: usage.apiKeyId,
          method: usage.method,
          statusCode: parseInt(usage.statusCode),
          responseTime: parseInt(usage.responseTime),
          timestamp: new Date(usage.timestamp),
        };
      });
      // batch processing into db
      const result = await this.prismaService.usageHistory.createMany({
        data: usageData,
        skipDuplicates: true,
      });
      await this.redisService.ltrim('usage:logs:all', lastUsages.length, -1);
      console.log(`Successfully flushed ${result.count} usage records to database`);
    } catch (error) {
      console.error('An error occured while writing data into database', error);
    }
  }
}
