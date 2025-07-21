import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';

@Controller('analytics')
export class AnalyticsController {
  constructor(private analyticsService: AnalyticsService) {}

  // Business dashboard
  @Get(':customerId/dashboard')
  async getBusinessDashboard(@Param('customerId', ParseIntPipe) customerId: number) {
    const [usageToday, usageWeek, usageMonth, topEndpoints, hourlyTrend, errorRate, growth] = await Promise.all([
      this.analyticsService.getUsageCount(customerId, 'today'),
      this.analyticsService.getUsageCount(customerId, 'week'),
      this.analyticsService.getUsageCount(customerId, 'month'),
      this.analyticsService.getTopEndpoint(customerId, 'week'),
      this.analyticsService.getUsageByPeriod(customerId, 'hour'),
      this.analyticsService.getErrorRate(customerId, 'week'),
      this.analyticsService.getUsageGrowth(customerId),
    ]);

    return {
      summary: {
        today: usageToday,
        thisWeek: usageWeek,
        thisMonth: usageMonth,
      },
      growth,
      errorRate,
      topEndpoints,
      hourlyTrend,
      generatedAt: new Date().toISOString(),
    };
  }

  @Get(':customerId/trends')
  async getUsageTrends(
    @Param('customerId', ParseIntPipe) customerId: number,
    @Query('period') period: 'hour' | 'day' = 'hour',
  ) {
    return this.analyticsService.getUsageByPeriod(customerId, period);
  }

  // Top endpoints analysis
  @Get(':customerId/endpoints')
  async getEndpointAnalysis(
    @Param('customerId', ParseIntPipe) customerId: number,
    @Query('period') period: 'day' | 'week' | 'month' = 'week',
  ) {
    return this.analyticsService.getTopEndpoint(customerId, period);
  }

  // Error monitoring
  @Get(':customerId/health')
  async getSystemHealth(
    @Param('customerId', ParseIntPipe) customerId: number,
    @Query('period') period: 'day' | 'week' = 'week',
  ) {
    return this.analyticsService.getErrorRate(customerId, period);
  }

  // Growth metrics
  @Get(':customerId/growth')
  async getGrowthMetrics(@Param('customerId', ParseIntPipe) customerId: number) {
    return this.analyticsService.getUsageGrowth(customerId);
  }

  // Individual usage counts
  @Get(':customerId/usage')
  async getUsageCount(
    @Param('customerId', ParseIntPipe) customerId: number,
    @Query('period') period: string = 'today',
  ) {
    const count = await this.analyticsService.getUsageCount(customerId, period);
    return { period, count };
  }
}
