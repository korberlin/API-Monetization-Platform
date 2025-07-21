import { Test, TestingModule } from '@nestjs/testing';
import { UsageTrackingService } from './usage-tracking.service';
import { RedisService } from '../../redis/redis.service';
import { UsageLog } from '../../interfaces/usage.interface';

describe('UsageTrackingService', () => {
  let usageTrackingService: UsageTrackingService;
  let redisService: jest.Mocked<RedisService>;

  const mockUsageLog: UsageLog = {
    customerId: 'customer-123',
    apiKey: 'test-api-key',
    apiKeyId: 1,
    endpoint: '/api/users',
    method: 'GET',
    statusCode: '200',
    responseTime: 150,
    timestamp: new Date('2024-01-01T12:00:00'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsageTrackingService,
        {
          provide: RedisService,
          useValue: {
            lpush: jest.fn(),
            ltrim: jest.fn(),
            lrange: jest.fn(),
          },
        },
      ],
    }).compile();

    usageTrackingService = module.get<UsageTrackingService>(UsageTrackingService);
    redisService = module.get(RedisService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('addUsageLog', () => {
    it('should successfully track usage in Redis', async () => {
      redisService.lpush.mockResolvedValue(1);
      redisService.ltrim.mockResolvedValue('OK');

      await usageTrackingService.addUsageLog(mockUsageLog);

      // Should add to customer-specific list
      expect(redisService.lpush).toHaveBeenCalledWith('usage:logs:customer-123', JSON.stringify(mockUsageLog));
      expect(redisService.ltrim).toHaveBeenCalledWith('usage:logs:customer-123', 0, 999);

      // Should add to global list
      expect(redisService.lpush).toHaveBeenCalledWith('usage:logs:all', JSON.stringify(mockUsageLog));
      expect(redisService.ltrim).toHaveBeenCalledWith('usage:logs:all', 0, 4999);
    });

    it('should handle Redis errors gracefully', async () => {
      redisService.lpush.mockRejectedValue(new Error('Redis error'));

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      // Should not throw
      await expect(usageTrackingService.addUsageLog(mockUsageLog)).resolves.not.toThrow();

      expect(consoleSpy).toHaveBeenCalledWith('Failed to track usage:', expect.any(Error));

      consoleSpy.mockRestore();
    });
  });

  describe('getCustomerApiHistory', () => {
    it('should return customer-specific usage logs', async () => {
      const storedLog = {
        ...mockUsageLog,
        timestamp: mockUsageLog.timestamp.toISOString(),
      };
      const mockLogs = [JSON.stringify(mockUsageLog)];
      redisService.lrange.mockResolvedValue(mockLogs);

      const result = await usageTrackingService.getCustomerApiHistory('customer-123');

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(storedLog);
      expect(redisService.lrange).toHaveBeenCalledWith('usage:logs:customer-123', 0, 99);
    });
  });
});
