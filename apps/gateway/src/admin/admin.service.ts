import { UsageTrackingService } from './../proxy/services/usage-tracking.service';
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { RateLimitService } from 'src/proxy/services/rate-limit.service';

@Injectable()
export class AdminService {
  constructor(
    private rateLimitService: RateLimitService,
    private prismaService: PrismaService,
    private usageTrackingService: UsageTrackingService,
  ) {}

  async getCustomerRateLimit(customerId: string) {
    const customer = await this.rateLimitService.getCustomerRateLimit(customerId);
    if (!customer) {
      throw new NotFoundException('Customer not found');
    }
    return customer;
  }

  async getAllStats() {
    return this.rateLimitService.getAllStats();
  }

  async getUsageLogs() {
    try {
      const logs = await this.prismaService.usageHistory.findMany({
        take: 100,
        orderBy: {
          timestamp: 'desc',
        },
        include: {
          customer: {
            include: {
              developer: true,
            },
          },
        },
      });
      return logs.map((log) => ({
        customerId: log.customerId,
        endpoint: log.endpoint,
        method: log.method,
        statusCode: log.statusCode,
        responseTime: log.responseTime,
        timestamp: log.timestamp,
        customerName: log.customer.name,
        developerName: log.customer.developer.name,
      }));
    } catch (error) {
      console.error('Failed to get usage logs', error);
      return [];
    }
  }

  async getCustomerApiHistory(customerId: string) {
    // fetch customer and find its usage
    return this.usageTrackingService.getCustomerApiHistory(customerId);
  }
}
