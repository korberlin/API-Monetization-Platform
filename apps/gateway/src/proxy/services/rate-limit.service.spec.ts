import { Test, TestingModule } from '@nestjs/testing';
import { RateLimitService } from './rate-limit.service';
import { RedisService } from 'src/redis/redis.service';

describe('RateLimitService', () => {
  let rateLimitService: RateLimitService;
  let redisService: jest.Mocked<RedisService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RateLimitService,
        {
          provide: RedisService,
          useValue: {
            hgetAll: jest.fn(),
            hset: jest.fn(),
            keys: jest.fn(),
          },
        },
      ],
    }).compile();

    rateLimitService = module.get<RateLimitService>(RateLimitService);
    redisService = module.get(RedisService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  describe('checkAndIncrement', () => {
    it('should allow first request and initialize rate limit tracking', async () => {
      // No existing rate limit data
      redisService.hgetAll.mockResolvedValue({});

      const savedValues: Record<string, any> = {};
      redisService.hset.mockImplementation(async (key, field, value) => {
        savedValues[field] = value;
        return Promise.resolve();
      });

      const result = await rateLimitService.checkAndIncrement('customer-123', 100);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(99);
      expect(redisService.hgetAll).toHaveBeenCalledWith('rate:limit:customer-123');
      expect(redisService.hset).toHaveBeenCalledWith('rate:limit:customer-123', 'count', 1);
      expect(redisService.hset).toHaveBeenCalledWith('rate:limit:customer-123', 'resetAt', expect.any(Date));

      const resetDate = savedValues.resetAt;
      expect(resetDate.getHours()).toBe(0);
      expect(resetDate.getMinutes()).toBe(0);
    });

    it('should allow request when under rate limit', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);

      const existingData = {
        count: '50',
        resetAt: tomorrow.toISOString(),
      };
      redisService.hgetAll.mockResolvedValue(existingData);

      const result = await rateLimitService.checkAndIncrement('customer-123', 100);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(50);
      expect(redisService.hset).toHaveBeenCalledWith('rate:limit:customer-123', 'count', 51);
      expect(redisService.hset).toHaveBeenCalledTimes(1); // Only count update, not resetAt
    });

    it('should reject request when exactly at rate limit', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);

      const existingData = {
        count: '100',
        resetAt: tomorrow.toISOString(),
      };
      redisService.hgetAll.mockResolvedValue(existingData);

      const result = await rateLimitService.checkAndIncrement('customer-123', 100);

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(redisService.hset).not.toHaveBeenCalled();
    });

    it('should reject request when over rate limit', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);

      const existingData = {
        count: '150',
        resetAt: tomorrow.toISOString(),
      };
      redisService.hgetAll.mockResolvedValue(existingData);

      const result = await rateLimitService.checkAndIncrement('customer-123', 100);

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(redisService.hset).not.toHaveBeenCalled();
    });

    it('should reset rate limit after midnight', async () => {
      jest.useFakeTimers();

      // Set current time to 12:01 AM on January 2nd
      const currentTime = new Date('2024-01-02T00:01:00');
      jest.setSystemTime(currentTime);

      // Rate limit was set for January 1st (now in the past)
      const existingData = {
        count: '100',
        resetAt: '2024-01-01T00:00:00',
      };
      redisService.hgetAll.mockResolvedValue(existingData);

      const result = await rateLimitService.checkAndIncrement('customer-123', 100);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(99);
      expect(redisService.hset).toHaveBeenCalledWith('rate:limit:customer-123', 'count', 1);
      expect(redisService.hset).toHaveBeenCalledWith('rate:limit:customer-123', 'resetAt', expect.any(Date));
    });
  });

  describe('getCustomerRateLimit', () => {
    it('should return customer rate limit data from Redis', async () => {
      const mockData = {
        count: '75',
        resetAt: '2024-01-01T00:00:00',
      };
      redisService.hgetAll.mockResolvedValue(mockData);

      const result = await rateLimitService.getCustomerRateLimit('customer-123');

      expect(result).toEqual(mockData);
      expect(redisService.hgetAll).toHaveBeenCalledWith('rate:limit:customer-123');
    });
  });

  describe('getAllStats', () => {
    it('should return rate limit stats for all customers', async () => {
      const mockKeys = ['rate:limit:customer-1', 'rate:limit:customer-2'];
      const mockData1 = { count: '50', resetAt: '2024-01-01T00:00:00' };
      const mockData2 = { count: '25', resetAt: '2024-01-01T00:00:00' };

      redisService.keys.mockResolvedValue(mockKeys);
      redisService.hgetAll.mockResolvedValueOnce(mockData1).mockResolvedValueOnce(mockData2);

      const result = await rateLimitService.getAllStats();

      expect(result).toEqual({
        'customer-1': { count: 50, resetAt: '2024-01-01T00:00:00' },
        'customer-2': { count: 25, resetAt: '2024-01-01T00:00:00' },
      });
      expect(redisService.keys).toHaveBeenCalledWith('rate:limit:*');
    });

    it('should handle errors gracefully in getAllStats', async () => {
      redisService.keys.mockRejectedValue(new Error('Redis error'));

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const result = await rateLimitService.getAllStats();

      expect(result).toBeUndefined();
      expect(consoleSpy).toHaveBeenCalledWith('An error occured while fetching data', expect.any(Error));

      consoleSpy.mockRestore();
    });
  });
});
