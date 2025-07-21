import { Test, TestingModule } from '@nestjs/testing';
import { PricingService } from './pricing.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';

describe('PricingService', () => {
  let pricingService: PricingService;
  let prismaService: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PricingService,
        {
          provide: PrismaService,
          useValue: {
            customer: {
              findFirst: jest.fn(),
              findUnique: jest.fn(),
            },
            tier: {
              findFirst: jest.fn(),
              findUnique: jest.fn(),
            },
            usageHistory: {
              count: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    pricingService = module.get<PricingService>(PricingService);
    prismaService = module.get(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('calculateCurrentPeriodCost', () => {
    const mockCustomer = {
      id: 1,
      name: 'Test Customer',
      tier: {
        id: 1,
        name: 'Pro',
        price: 99.99,
        rateLimit: 10000,
        features: ['Feature 1', 'Feature 2'],
      },
    };

    it('should return current period cost for customer', async () => {
      prismaService.customer.findFirst.mockResolvedValue(mockCustomer);

      const result = await pricingService.calculateCurrentPeriodCost(1);

      expect(result).toEqual({
        price: 99.99,
        tierName: 'Pro',
        customerId: 1,
        period: 'monthly',
      });
      expect(prismaService.customer.findFirst).toHaveBeenCalledWith({
        where: { id: 1 },
        include: { tier: true },
      });
    });

    it('should handle free tier correctly', async () => {
      const freeCustomer = {
        ...mockCustomer,
        tier: {
          ...mockCustomer.tier,
          name: 'Free',
          price: 0,
        },
      };
      prismaService.customer.findFirst.mockResolvedValue(freeCustomer);

      const result = await pricingService.calculateCurrentPeriodCost(1);

      expect(result.price).toBe(0);
      expect(result.tierName).toBe('Free');
    });

    it('should throw NotFoundException when customer does not exist', async () => {
      prismaService.customer.findFirst.mockResolvedValue(null);

      await expect(pricingService.calculateCurrentPeriodCost(999)).rejects.toThrow(NotFoundException);
      await expect(pricingService.calculateCurrentPeriodCost(999)).rejects.toThrow('No customer found');
    });
  });

  describe('getTierPricing', () => {
    const mockTier = {
      id: 1,
      name: 'Pro',
      price: { toNumber: () => 99.99 },
      rateLimit: 10000,
      features: ['API Analytics', 'Priority Support'],
    };

    it('should return tier pricing details', async () => {
      prismaService.tier.findFirst.mockResolvedValue(mockTier);

      const result = await pricingService.getTierPricing(1);

      expect(result).toEqual({
        id: 1,
        name: 'Pro',
        price: 99.99,
        rateLimit: 10000,
        features: ['API Analytics', 'Priority Support'],
      });
      expect(prismaService.tier.findFirst).toHaveBeenCalledWith({
        where: { id: 1 },
      });
    });

    it('should handle Decimal price conversion', async () => {
      const tierWithDecimal = {
        ...mockTier,
        price: { toNumber: () => 49.99 },
      };
      prismaService.tier.findFirst.mockResolvedValue(tierWithDecimal);

      const result = await pricingService.getTierPricing(1);

      expect(result.price).toBe(49.99);
      expect(typeof result.price).toBe('number');
    });

    it('should throw NotFoundException when tier does not exist', async () => {
      prismaService.tier.findFirst.mockResolvedValue(null);

      await expect(pricingService.getTierPricing(999)).rejects.toThrow(NotFoundException);
      await expect(pricingService.getTierPricing(999)).rejects.toThrow('No tier found');
    });
  });

  describe('calculateUsageForPeriod', () => {
    const startDate = new Date('2024-01-01');
    const endDate = new Date('2024-01-31');

    it('should calculate usage count for period', async () => {
      prismaService.usageHistory.count.mockResolvedValue(1500);

      const result = await pricingService.calculateUsageForPeriod(1, startDate, endDate);

      expect(result).toEqual({
        customerId: 1,
        usage: 1500,
        period: {
          start: startDate,
          end: endDate,
        },
      });
      expect(prismaService.usageHistory.count).toHaveBeenCalledWith({
        where: {
          customerId: 1,
          timestamp: {
            gte: startDate,
            lt: endDate,
          },
        },
      });
    });

    it('should handle zero usage', async () => {
      prismaService.usageHistory.count.mockResolvedValue(0);

      const result = await pricingService.calculateUsageForPeriod(1, startDate, endDate);

      expect(result.usage).toBe(0);
    });

    it('should handle same day period', async () => {
      const sameDay = new Date('2024-01-15');
      prismaService.usageHistory.count.mockResolvedValue(50);

      const result = await pricingService.calculateUsageForPeriod(1, sameDay, sameDay);

      expect(result.period.start).toEqual(sameDay);
      expect(result.period.end).toEqual(sameDay);
    });
  });

  describe('estimateMonthlyCost', () => {
    const mockCustomer = {
      id: 1,
      name: 'Test Customer',
      tier: {
        id: 1,
        name: 'Free',
        price: { toNumber: () => 0 },
      },
    };

    const mockProTier = {
      id: 2,
      name: 'Pro',
      price: { toNumber: () => 99.99 },
    };

    it('should return current tier cost when no new tier specified', async () => {
      prismaService.customer.findUnique.mockResolvedValue(mockCustomer);

      const result = await pricingService.estimateMonthlyCost(1);

      expect(result).toEqual({
        currentTier: 'Free',
        currentPrice: 0,
      });
      expect(prismaService.tier.findUnique).not.toHaveBeenCalled();
    });

    it('should compare tiers when new tier specified', async () => {
      prismaService.customer.findUnique.mockResolvedValue(mockCustomer);
      prismaService.tier.findUnique.mockResolvedValue(mockProTier);

      const result = await pricingService.estimateMonthlyCost(1, 2);

      expect(result).toEqual({
        currentTier: 'Free',
        currentPrice: 0,
        newTier: 'Pro',
        newPrice: 99.99,
        savings: 0,
        additionalCost: 99.99,
      });
    });

    it('should calculate savings when downgrading', async () => {
      const proCustomer = {
        ...mockCustomer,
        tier: {
          id: 2,
          name: 'Pro',
          price: { toNumber: () => 99.99 },
        },
      };
      const basicTier = {
        id: 3,
        name: 'Basic',
        price: { toNumber: () => 49.99 },
      };

      prismaService.customer.findUnique.mockResolvedValue(proCustomer);
      prismaService.tier.findUnique.mockResolvedValue(basicTier);

      const result = await pricingService.estimateMonthlyCost(1, 3);

      expect(result).toEqual({
        currentTier: 'Pro',
        currentPrice: 99.99,
        newTier: 'Basic',
        newPrice: 49.99,
        savings: 50,
        additionalCost: 0,
      });
    });

    it('should return only current info when same tier ID is provided', async () => {
      prismaService.customer.findUnique.mockResolvedValue(mockCustomer);
      prismaService.tier.findUnique.mockResolvedValue(mockCustomer.tier);

      const result = await pricingService.estimateMonthlyCost(1, 1);

      expect(result).toEqual({
        currentTier: 'Free',
        currentPrice: 0,
      });
      expect(result).not.toHaveProperty('newTier');
    });

    it('should throw NotFoundException when customer does not exist', async () => {
      prismaService.customer.findUnique.mockResolvedValue(null);

      await expect(pricingService.estimateMonthlyCost(999)).rejects.toThrow(NotFoundException);
      await expect(pricingService.estimateMonthlyCost(999)).rejects.toThrow('Customer with ID 999 not found');
    });

    it('should throw NotFoundException when new tier does not exist', async () => {
      prismaService.customer.findUnique.mockResolvedValue(mockCustomer);
      prismaService.tier.findUnique.mockResolvedValue(null);

      await expect(pricingService.estimateMonthlyCost(1, 999)).rejects.toThrow(NotFoundException);
      await expect(pricingService.estimateMonthlyCost(1, 999)).rejects.toThrow('Tier with ID 999 not found');
    });
  });
});
