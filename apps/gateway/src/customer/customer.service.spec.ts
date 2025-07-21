import { Test, TestingModule } from '@nestjs/testing';
import { CustomerService } from './customer.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

describe('CustomerService', () => {
  let customerService: CustomerService;
  let prismaService: PrismaService;
  let redisService: RedisService;

  const mockApiKeyData = {
    id: 'key-1',
    key: 'test-api-key',
    isActive: true,
    expiresAt: null,
    customer: {
      id: 'customer-1',
      email: 'test@example.com',
      isActive: true,
      tier: {
        id: 'tier-1',
        name: 'Pro',
        rateLimit: 1000,
      },
      developer: {
        id: 'dev-1',
        name: 'Test Developer',
        apiUrl: 'https://api.example.com',
      },
    },
  };

  const expectedReturnData = {
    customer: {
      id: 'customer-1',
      email: 'test@example.com',
      tier: {
        id: 'tier-1',
        name: 'Pro',
        rateLimit: 1000,
      },
      rateLimit: 1000,
    },
    developer: {
      id: 'dev-1',
      name: 'Test Developer',
      apiUrl: 'https://api.example.com',
    },
    apiKey: {
      id: 'key-1',
      isActive: true,
      expiresAt: null,
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CustomerService,
        {
          provide: PrismaService,
          useValue: {
            apiKey: {
              findFirst: jest.fn(),
            },
          },
        },
        {
          provide: RedisService,
          useValue: {
            get: jest.fn(),
            setex: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    customerService = module.get<CustomerService>(CustomerService);
    prismaService = module.get(PrismaService);
    redisService = module.get(RedisService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findByApiKey', () => {
    it('should return customer data from cache when available', async () => {
      const cachedData = JSON.stringify(expectedReturnData);
      (redisService.get as jest.Mock).mockResolvedValue(cachedData);

      const result = await customerService.findByApiKey('test-api-key');

      expect(result).toEqual(expectedReturnData);
      expect(redisService.get).toHaveBeenCalledWith('customer:apiKey:test-api-key');
      expect(prismaService.apiKey.findFirst).not.toHaveBeenCalled();
    });

    it('should fetch from database when not in cache and cache the result', async () => {
      (redisService.get as jest.Mock).mockResolvedValue(null);
      (prismaService.apiKey.findFirst as jest.Mock).mockResolvedValue(mockApiKeyData);

      const result = await customerService.findByApiKey('test-api-key');

      expect(result).toEqual(expectedReturnData);
      expect(prismaService.apiKey.findFirst).toHaveBeenCalledWith({
        where: { key: 'test-api-key' },
        include: {
          customer: {
            include: {
              developer: true,
              tier: true,
            },
          },
        },
      });
      expect(redisService.setex).toHaveBeenCalledWith(
        'customer:apiKey:test-api-key',
        300,
        JSON.stringify(expectedReturnData),
      );
    });

    it('should return null for non-existent API key', async () => {
      (redisService.get as jest.Mock).mockResolvedValue(null);
      (prismaService.apiKey.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await customerService.findByApiKey('invalid-key');

      expect(result).toBeNull();
      expect(redisService.setex).not.toHaveBeenCalled();
    });

    it('should return null for inactive API key', async () => {
      (redisService.get as jest.Mock).mockResolvedValue(null);
      const inactiveApiKey = { ...mockApiKeyData, isActive: false };
      (prismaService.apiKey.findFirst as jest.Mock).mockResolvedValue(inactiveApiKey);

      const result = await customerService.findByApiKey('inactive-key');

      expect(result).toBeNull();
      expect(redisService.setex).not.toHaveBeenCalled();
    });

    it('should return null for expired API key', async () => {
      (redisService.get as jest.Mock).mockResolvedValue(null);
      const expiredApiKey = {
        ...mockApiKeyData,
        expiresAt: new Date('2023-01-01'), // Past date
      };
      (prismaService.apiKey.findFirst as jest.Mock).mockResolvedValue(expiredApiKey);

      const result = await customerService.findByApiKey('expired-key');

      expect(result).toBeNull();
      expect(redisService.setex).not.toHaveBeenCalled();
    });

    it('should return null when customer is inactive', async () => {
      (redisService.get as jest.Mock).mockResolvedValue(null);
      const apiKeyWithInactiveCustomer = {
        ...mockApiKeyData,
        customer: {
          ...mockApiKeyData.customer,
          isActive: false,
        },
      };
      (prismaService.apiKey.findFirst as jest.Mock).mockResolvedValue(apiKeyWithInactiveCustomer);

      const result = await customerService.findByApiKey('test-key');

      expect(result).toBeNull();
      expect(redisService.setex).not.toHaveBeenCalled();
    });

    it('should fallback to database when Redis fails', async () => {
      (redisService.get as jest.Mock).mockRejectedValue(new Error('Redis connection failed'));
      (prismaService.apiKey.findFirst as jest.Mock).mockResolvedValue(mockApiKeyData);

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const result = await customerService.findByApiKey('test-api-key');

      expect(result).toEqual(expectedReturnData);
      expect(consoleSpy).toHaveBeenCalledWith('Redis error, falling back to database:', expect.any(Error));
      expect(prismaService.apiKey.findFirst).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });
});
