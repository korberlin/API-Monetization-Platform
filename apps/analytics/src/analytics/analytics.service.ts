import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class AnalyticsService {
  constructor(private prismaService: PrismaService) {}

  async getUsageCount(customerId: number, period: string) {
    const customer = await this.prismaService.customer.findUnique({
      where: {
        id: customerId,
      },
    });
    if (!customer) {
      throw new NotFoundException('Customer not found');
    }
    const now = new Date();
    let startDate: Date;

    if (period === 'today') {
      // fetch for today
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (period === 'week') {
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else {
      // fetch for month
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    // count the usage history records within this time range
    const count = await this.prismaService.usageHistory.count({
      where: {
        customerId: customerId,
        timestamp: {
          gte: startDate,
          lte: now,
        },
      },
    });
    return count;
  }

  async getTopEndpoint(customerId: number, period: 'day' | 'week' | 'month' | 'all' = 'month') {
    let startDate: Date | undefined;
    if (period !== 'all') {
      const now = new Date();
      switch (period) {
        case 'day':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
      }
    }
    const customer = await this.prismaService.customer.findUnique({
      where: {
        id: customerId,
      },
    });
    if (!customer) {
      throw new NotFoundException('Customer not found');
    }
    const results = await this.prismaService.usageHistory.groupBy({
      by: ['endpoint'],
      where: {
        customerId: customerId,
        ...(startDate && {
          timestamp: {
            gte: startDate,
          },
        }),
      },
      _count: {
        endpoint: true,
      },
      orderBy: {
        _count: {
          endpoint: 'desc',
        },
      },
      take: 5,
    });
    if (results.length === 0) {
      return [];
    }
    return results.map((result) => ({
      endpoint: result.endpoint,
      requestCount: result._count.endpoint,
    }));
  }
  async getUsageByPeriod(customerId: number, period: 'hour' | 'day') {
    const customer = await this.prismaService.customer.findUnique({
      where: {
        id: customerId,
      },
    });
    if (!customer) {
      throw new NotFoundException('Customer not found');
    }
    const now = new Date();
    let startDate: Date;
    let bucketCount: number;
    if (period === 'hour') {
      // last 24 hours
      // round current time to the hour
      const currentHour = new Date(now);
      currentHour.setMinutes(0, 0, 0);
      startDate = new Date(currentHour.getTime() - 23 * 60 * 60 * 1000);
      bucketCount = 24;
    } else {
      // last 7 days
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      bucketCount = 7;
    }
    const records = await this.prismaService.usageHistory.findMany({
      where: {
        customerId,
        timestamp: {
          gte: startDate,
          lte: now,
        },
      },
      select: {
        timestamp: true,
      },
      orderBy: {
        timestamp: 'asc',
      },
    });
    const buckets = new Map<string, number>();
    for (let i = 0; i < bucketCount; i++) {
      const bucketTime = new Date(startDate);
      if (period === 'hour') {
        bucketTime.setHours(bucketTime.getHours() + i);
        bucketTime.setMinutes(0, 0, 0);
      } else {
        bucketTime.setDate(bucketTime.getDate() + i);
        bucketTime.setHours(0, 0, 0, 0);
      }
      const key = bucketTime.toISOString();
      buckets.set(key, 0);
    }
    records.forEach((record) => {
      const recordTime = new Date(record.timestamp);

      if (period === 'hour') {
        // round to hour
        recordTime.setMinutes(0, 0, 0);
      } else {
        // round to day
        recordTime.setHours(0, 0, 0, 0);
      }
      const key = recordTime.toISOString();
      if (buckets.has(key)) {
        buckets.set(key, buckets.get(key)! + 1);
      }
    });
    const result = Array.from(buckets.entries()).map(([timestamp, count]) => {
      const date = new Date(timestamp);
      return {
        timestamp,
        label:
          period === 'hour'
            ? date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
            : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        count,
      };
    });
    return {
      period,
      totalRequests: records.length,
      data: result,
    };
  }

  async getErrorRate(customerId: number, period: 'day' | 'week' = 'week') {
    const customer = await this.prismaService.customer.findUnique({
      where: {
        id: customerId,
      },
    });
    if (!customer) {
      throw new NotFoundException('Customer not found');
    }
    const now = new Date();
    let startDate: Date;
    if (period === 'day') {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else {
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }

    const totalRequests = await this.prismaService.usageHistory.count({
      where: {
        customerId,
        timestamp: {
          gte: startDate,
        },
      },
    });
    const errorRequests = await this.prismaService.usageHistory.count({
      where: {
        customerId,
        timestamp: {
          gte: startDate,
        },
        statusCode: {
          gte: 400,
        },
      },
    });
    let errorRate: number;
    if (totalRequests > 0) {
      errorRate = (errorRequests / totalRequests) * 100;
    } else {
      errorRate = 0;
    }
    return {
      period,
      totalRequests,
      errorRequests,
      errorRate: Math.round(errorRate * 100) / 100, // round to 2 decimals
      isHealthy: errorRate < 5, // %5 error rate is acceptable
    };
  }
  async getUsageGrowth(customerId: number) {
    const customer = await this.prismaService.customer.findUnique({
      where: {
        id: customerId,
      },
    });
    if (!customer) {
      throw new NotFoundException('Customer not found');
    }
    const now = new Date();
    const thisWeekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thisWeekCount = await this.prismaService.usageHistory.count({
      where: {
        customerId: customerId,
        timestamp: {
          gte: thisWeekStart,
        },
      },
    });
    // previous week
    const lastWeekstart = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const lastWeekCount = await this.prismaService.usageHistory.count({
      where: {
        customerId: customerId,
        timestamp: {
          gte: lastWeekstart,
          lt: thisWeekStart,
        },
      },
    });
    const growthAmount = thisWeekCount - lastWeekCount;
    let growthRate: number;
    if (lastWeekCount > 0) {
      growthRate = Math.round((growthAmount / lastWeekCount) * 100 * 100) / 100;
    } else {
      if (thisWeekCount > 0) {
        growthRate = 100;
      } else {
        growthRate = 0;
      }
    }
    return {
      thisWeek: thisWeekCount,
      lastWeek: lastWeekCount,
      growth: {
        count: growthAmount,
        percentage: growthRate,
        trend: growthAmount > 0 ? 'up' : growthAmount < 0 ? 'down' : 'stable',
      },
    };
  }
}
