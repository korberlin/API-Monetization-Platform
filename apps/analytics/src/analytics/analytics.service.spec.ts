import { Test, TestingModule } from '@nestjs/testing';
import { AnalyticsService } from './analytics.service';

import { NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

describe('AnalyticsService', () => {
  let analyticsService: AnalyticsService;
  let prismaService: any; // Using 'any' to bypass Prisma's complex types

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        {
          provide: PrismaService,
          useValue: {
            customer: {
              findUnique: jest.fn(),
            },
            usageHistory: {
              count: jest.fn(),
              findMany: jest.fn(),
              groupBy: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    analyticsService = module.get<AnalyticsService>(AnalyticsService);
    prismaService = module.get(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  describe('getUsageCount', () => {
    const mockCustomer = { id: 1, name: 'Test Customer' };

    it('should return usage count for today', async () => {
      prismaService.customer.findUnique.mockResolvedValue(mockCustomer);
      prismaService.usageHistory.count.mockResolvedValue(42);

      const result = await analyticsService.getUsageCount(1, 'today');

      expect(result).toBe(42);
      expect(prismaService.customer.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
      });
      
      const countCall = prismaService.usageHistory.count.mock.calls[0][0];
      const startDate = countCall.where.timestamp.gte;
      expect(startDate.getHours()).toBe(0);
      expect(startDate.getMinutes()).toBe(0);
    });

    it('should return usage count for week', async () => {
      jest.useFakeTimers();
      const now = new Date('2024-01-15T10:00:00');
      jest.setSystemTime(now);

      prismaService.customer.findUnique.mockResolvedValue(mockCustomer);
      prismaService.usageHistory.count.mockResolvedValue(300);

      const result = await analyticsService.getUsageCount(1, 'week');

      expect(result).toBe(300);
      
      const countCall = prismaService.usageHistory.count.mock.calls[0][0];
      const startDate = countCall.where.timestamp.gte;
      const expectedDate = new Date('2024-01-08T10:00:00');
      expect(startDate.getTime()).toBeCloseTo(expectedDate.getTime(), -1000);
    });

    it('should return usage count for month', async () => {
      prismaService.customer.findUnique.mockResolvedValue(mockCustomer);
      prismaService.usageHistory.count.mockResolvedValue(1500);

      const result = await analyticsService.getUsageCount(1, 'month');

      expect(result).toBe(1500);
      
      const countCall = prismaService.usageHistory.count.mock.calls[0][0];
      const startDate = countCall.where.timestamp.gte;
      expect(startDate.getDate()).toBe(1);
    });

    it('should throw NotFoundException when customer does not exist', async () => {
      prismaService.customer.findUnique.mockResolvedValue(null);

      await expect(analyticsService.getUsageCount(999, 'today')).rejects.toThrow(NotFoundException);
      await expect(analyticsService.getUsageCount(999, 'today')).rejects.toThrow('Customer not found');
    });
  });

  describe('getTopEndpoint', () => {
    const mockCustomer = { id: 1, name: 'Test Customer' };
    const mockGroupByResults = [
      { endpoint: '/api/users', _count: { endpoint: 100 } },
      { endpoint: '/api/products', _count: { endpoint: 75 } },
      { endpoint: '/api/orders', _count: { endpoint: 50 } },
    ];

    it('should return top 5 endpoints for month period', async () => {
      prismaService.customer.findUnique.mockResolvedValue(mockCustomer);
      prismaService.usageHistory.groupBy.mockResolvedValue(mockGroupByResults);

      const result = await analyticsService.getTopEndpoint(1, 'month');

      expect(result).toEqual([
        { endpoint: '/api/users', requestCount: 100 },
        { endpoint: '/api/products', requestCount: 75 },
        { endpoint: '/api/orders', requestCount: 50 },
      ]);
      
      const groupByCall = prismaService.usageHistory.groupBy.mock.calls[0][0];
      expect(groupByCall.take).toBe(5);
      expect(groupByCall.where.timestamp).toBeDefined();
    });

    it('should return all time endpoints when period is all', async () => {
      prismaService.customer.findUnique.mockResolvedValue(mockCustomer);
      prismaService.usageHistory.groupBy.mockResolvedValue(mockGroupByResults);

      const result = await analyticsService.getTopEndpoint(1, 'all');

      const groupByCall = prismaService.usageHistory.groupBy.mock.calls[0][0];
      expect(groupByCall.where.timestamp).toBeUndefined();
    });

    it('should return empty array when no usage history exists', async () => {
      prismaService.customer.findUnique.mockResolvedValue(mockCustomer);
      prismaService.usageHistory.groupBy.mockResolvedValue([]);

      const result = await analyticsService.getTopEndpoint(1, 'week');

      expect(result).toEqual([]);
    });

    it('should throw NotFoundException when customer does not exist', async () => {
      prismaService.customer.findUnique.mockResolvedValue(null);

      await expect(analyticsService.getTopEndpoint(999, 'month')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getUsageByPeriod', () => {
    const mockCustomer = { id: 1, name: 'Test Customer' };

    it('should return hourly usage for last 24 hours', async () => {
      jest.useFakeTimers();
      const now = new Date('2024-01-15T15:30:00Z'); // Add 'Z' for UTC
      jest.setSystemTime(now);

      prismaService.customer.findUnique.mockResolvedValue(mockCustomer);
      
      const mockRecords = [
        { timestamp: new Date('2024-01-15T14:15:00Z') }, // Add 'Z' for UTC
        { timestamp: new Date('2024-01-15T14:45:00Z') }, // Add 'Z' for UTC
        { timestamp: new Date('2024-01-15T15:10:00Z') }, // Add 'Z' for UTC
      ];
      prismaService.usageHistory.findMany.mockResolvedValue(mockRecords);

      const result = await analyticsService.getUsageByPeriod(1, 'hour');

      expect(result.period).toBe('hour');
      expect(result.totalRequests).toBe(3);
      expect(result.data).toHaveLength(24);
      
      // Check that we have entries for the hours with data
      const hour14 = result.data.find(d => d.timestamp.includes('T14:00:00'));
      expect(hour14).toBeDefined();
      expect(hour14!.count).toBe(2);
      
      const hour15 = result.data.find(d => d.timestamp.includes('T15:00:00'));
      expect(hour15).toBeDefined();
      expect(hour15!.count).toBe(1);
    });

    it('should return daily usage for last 7 days', async () => {
      jest.useFakeTimers();
      const now = new Date('2024-01-15T10:00:00');
      jest.setSystemTime(now);

      prismaService.customer.findUnique.mockResolvedValue(mockCustomer);
      
      const mockRecords = [
        { timestamp: new Date('2024-01-14T10:00:00') },
        { timestamp: new Date('2024-01-14T15:00:00') },
        { timestamp: new Date('2024-01-13T08:00:00') },
      ];
      prismaService.usageHistory.findMany.mockResolvedValue(mockRecords);

      const result = await analyticsService.getUsageByPeriod(1, 'day');

      expect(result.period).toBe('day');
      expect(result.totalRequests).toBe(3);
      expect(result.data).toHaveLength(7);
    });

    it('should handle empty usage history', async () => {
      prismaService.customer.findUnique.mockResolvedValue(mockCustomer);
      prismaService.usageHistory.findMany.mockResolvedValue([]);

      const result = await analyticsService.getUsageByPeriod(1, 'hour');

      expect(result.totalRequests).toBe(0);
      expect(result.data).toHaveLength(24);
      expect(result.data.every(d => d.count === 0)).toBe(true);
    });

    it('should throw NotFoundException when customer does not exist', async () => {
      prismaService.customer.findUnique.mockResolvedValue(null);

      await expect(analyticsService.getUsageByPeriod(999, 'hour')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getErrorRate', () => {
    const mockCustomer = { id: 1, name: 'Test Customer' };

    it('should calculate error rate correctly', async () => {
      prismaService.customer.findUnique.mockResolvedValue(mockCustomer);
      prismaService.usageHistory.count
        .mockResolvedValueOnce(1000) // total requests
        .mockResolvedValueOnce(50);  // error requests

      const result = await analyticsService.getErrorRate(1, 'week');

      expect(result).toEqual({
        period: 'week',
        totalRequests: 1000,
        errorRequests: 50,
        errorRate: 5,
        isHealthy: false,
      });
    });

    it('should handle zero total requests', async () => {
      prismaService.customer.findUnique.mockResolvedValue(mockCustomer);
      prismaService.usageHistory.count
        .mockResolvedValueOnce(0)  // total requests
        .mockResolvedValueOnce(0); // error requests

      const result = await analyticsService.getErrorRate(1, 'day');

      expect(result.errorRate).toBe(0);
      expect(result.isHealthy).toBe(true);
    });

    it('should mark as healthy when error rate is below 5%', async () => {
      prismaService.customer.findUnique.mockResolvedValue(mockCustomer);
      prismaService.usageHistory.count
        .mockResolvedValueOnce(1000) // total requests
        .mockResolvedValueOnce(40);  // error requests (4%)

      const result = await analyticsService.getErrorRate(1, 'week');

      expect(result.errorRate).toBe(4);
      expect(result.isHealthy).toBe(true);
    });

    it('should throw NotFoundException when customer does not exist', async () => {
      prismaService.customer.findUnique.mockResolvedValue(null);

      await expect(analyticsService.getErrorRate(999, 'week')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getUsageGrowth', () => {
    const mockCustomer = { id: 1, name: 'Test Customer' };

    it('should calculate positive growth correctly', async () => {
      prismaService.customer.findUnique.mockResolvedValue(mockCustomer);
      prismaService.usageHistory.count
        .mockResolvedValueOnce(150) // this week
        .mockResolvedValueOnce(100); // last week

      const result = await analyticsService.getUsageGrowth(1);

      expect(result).toEqual({
        thisWeek: 150,
        lastWeek: 100,
        growth: {
          count: 50,
          percentage: 50,
          trend: 'up',
        },
      });
    });

    it('should calculate negative growth correctly', async () => {
      prismaService.customer.findUnique.mockResolvedValue(mockCustomer);
      prismaService.usageHistory.count
        .mockResolvedValueOnce(80)  // this week
        .mockResolvedValueOnce(100); // last week

      const result = await analyticsService.getUsageGrowth(1);

      expect(result).toEqual({
        thisWeek: 80,
        lastWeek: 100,
        growth: {
          count: -20,
          percentage: -20,
          trend: 'down',
        },
      });
    });

    it('should handle zero last week count', async () => {
      prismaService.customer.findUnique.mockResolvedValue(mockCustomer);
      prismaService.usageHistory.count
        .mockResolvedValueOnce(50) // this week
        .mockResolvedValueOnce(0); // last week

      const result = await analyticsService.getUsageGrowth(1);

      expect(result.growth.percentage).toBe(100);
      expect(result.growth.trend).toBe('up');
    });

    it('should handle both weeks being zero', async () => {
      prismaService.customer.findUnique.mockResolvedValue(mockCustomer);
      prismaService.usageHistory.count
        .mockResolvedValueOnce(0) // this week
        .mockResolvedValueOnce(0); // last week

      const result = await analyticsService.getUsageGrowth(1);

      expect(result.growth.percentage).toBe(0);
      expect(result.growth.trend).toBe('stable');
    });

    it('should throw NotFoundException when customer does not exist', async () => {
      prismaService.customer.findUnique.mockResolvedValue(null);

      await expect(analyticsService.getUsageGrowth(999)).rejects.toThrow(NotFoundException);
    });
  });
});