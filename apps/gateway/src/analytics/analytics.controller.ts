// apps/gateway/src/analytics/analytics.controller.ts

import { Controller, Get, Query, Req } from '@nestjs/common';
import { Request } from 'express';
import { AnalyticsClientService } from './analytics-client.service';
import { ApiTags, ApiOperation, ApiResponse, ApiSecurity, ApiQuery } from '@nestjs/swagger';

@ApiTags('Analytics')
@ApiSecurity('api-key')
@Controller('analytics')
export class AnalyticsController {
  constructor(private analyticsClient: AnalyticsClientService) {}

  @Get('dashboard')
  @ApiOperation({
    summary: 'Get analytics dashboard',
    description:
      'Returns comprehensive analytics including usage summary, growth metrics, error rates, and top endpoints for the authenticated customer',
  })
  @ApiResponse({
    status: 200,
    description: 'Analytics dashboard data',
    schema: {
      example: {
        summary: {
          today: 342,
          thisWeek: 1250,
          thisMonth: 4875,
        },
        growth: {
          thisWeek: 1250,
          lastWeek: 980,
          growth: {
            count: 270,
            percentage: 27.55,
            trend: 'up',
          },
        },
        errorRate: {
          period: 'week',
          totalRequests: 5420,
          errorRequests: 23,
          errorRate: 0.42,
          isHealthy: true,
        },
        topEndpoints: [
          { endpoint: '/api/users', requestCount: 342 },
          { endpoint: '/api/products', requestCount: 287 },
          { endpoint: '/api/orders', requestCount: 198 },
        ],
        hourlyTrend: {
          period: 'hour',
          totalRequests: 342,
          data: [
            { timestamp: '2024-01-20T10:00:00.000Z', label: '10:00', count: 15 },
            { timestamp: '2024-01-20T11:00:00.000Z', label: '11:00', count: 23 },
          ],
        },
        generatedAt: '2024-01-20T15:30:00.000Z',
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Invalid or missing API key' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  async getDashboard(@Req() request: Request) {
    const customerId = request['customer'].id;
    return this.analyticsClient.getCustomerDashboard(customerId);
  }

  @Get('trends')
  @ApiOperation({
    summary: 'Get usage trends over time',
    description: 'Returns API usage trends aggregated by hour or day for the authenticated customer',
  })
  @ApiQuery({
    name: 'period',
    enum: ['hour', 'day'],
    required: false,
    description: 'Time period for trend analysis (default: hour)',
  })
  @ApiResponse({
    status: 200,
    description: 'Usage trend data',
    schema: {
      example: {
        period: 'hour',
        totalRequests: 342,
        data: [
          { timestamp: '2024-01-20T10:00:00.000Z', label: '10:00', count: 15 },
          { timestamp: '2024-01-20T11:00:00.000Z', label: '11:00', count: 23 },
          { timestamp: '2024-01-20T12:00:00.000Z', label: '12:00', count: 31 },
          { timestamp: '2024-01-20T13:00:00.000Z', label: '13:00', count: 28 },
        ],
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Invalid or missing API key' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  async getTrends(@Req() request: Request, @Query('period') period?: 'hour' | 'day') {
    const customerId = request['customer'].id;
    return this.analyticsClient.getUsageTrends(customerId, period);
  }

  @Get('endpoints')
  @ApiOperation({
    summary: 'Get top endpoints analysis',
    description: 'Returns the most frequently called endpoints for the specified time period',
  })
  @ApiQuery({
    name: 'period',
    enum: ['day', 'week', 'month'],
    required: true,
    description: 'Time period for endpoint analysis',
  })
  @ApiResponse({
    status: 200,
    description: 'Top endpoints data',
    schema: {
      example: [
        { endpoint: '/api/users', requestCount: 1542 },
        { endpoint: '/api/products', requestCount: 1287 },
        { endpoint: '/api/orders', requestCount: 998 },
        { endpoint: '/api/auth/login', requestCount: 756 },
        { endpoint: '/api/search', requestCount: 623 },
      ],
    },
  })
  @ApiResponse({ status: 401, description: 'Invalid or missing API key' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  async getEndpoints(@Req() request: Request, @Query('period') period: 'day' | 'week' | 'month') {
    const customerId = request['customer'].id;
    return this.analyticsClient.getEndpointAnalysis(customerId, period);
  }

  @Get('health')
  @ApiOperation({
    summary: 'Get system health metrics',
    description: 'Returns error rate and health status for the specified period',
  })
  @ApiQuery({
    name: 'period',
    enum: ['day', 'week', 'month'],
    required: false,
    description: 'Time period for health analysis (default: week)',
  })
  @ApiResponse({
    status: 200,
    description: 'System health data',
    schema: {
      example: {
        period: 'week',
        totalRequests: 5420,
        errorRequests: 23,
        errorRate: 0.42,
        isHealthy: true,
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Invalid or missing API key' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  async getSystemHealth(@Req() request: Request, @Query('period') period: 'day' | 'week' | 'month' = 'week') {
    const customerId = request['customer'].id;
    return this.analyticsClient.getSystemHealth(customerId, period);
  }

  @Get('growth')
  @ApiOperation({
    summary: 'Get growth metrics',
    description: 'Returns usage growth comparison between current week and previous week',
  })
  @ApiResponse({
    status: 200,
    description: 'Growth metrics data',
    schema: {
      example: {
        thisWeek: 1250,
        lastWeek: 980,
        growth: {
          count: 270,
          percentage: 27.55,
          trend: 'up',
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Invalid or missing API key' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  async getGrowthMetrics(@Req() request: Request) {
    const customerId = request['customer'].id;
    return this.analyticsClient.getGrowthMetrics(customerId);
  }

  @Get('usage')
  @ApiOperation({
    summary: 'Get usage count',
    description: 'Returns the total API usage count for the specified period',
  })
  @ApiQuery({
    name: 'period',
    enum: ['day', 'week', 'month'],
    required: false,
    description: 'Time period for usage count (default: week)',
  })
  @ApiResponse({
    status: 200,
    description: 'Usage count data',
    schema: {
      example: {
        period: 'week',
        count: 1250,
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Invalid or missing API key' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  async getUsageCount(@Req() request: Request, @Query('period') period: 'day' | 'week' | 'month' = 'week') {
    const customerId = request['customer'].id;
    return this.analyticsClient.getUsageCount(customerId, period);
  }
}
