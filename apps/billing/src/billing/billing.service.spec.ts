import { Test, TestingModule } from '@nestjs/testing';
import { BillingService } from './billing.service';
import { PrismaService } from '../prisma/prisma.service';
import { PricingService } from '../pricing/pricing.service';
import { NotFoundException } from '@nestjs/common';

describe('BillingService', () => {
  let billingService: BillingService;
  let prismaService: any;
  let pricingService: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BillingService,
        {
          provide: PrismaService,
          useValue: {
            customer: {
              findUnique: jest.fn(),
              findFirst: jest.fn(),
            },
            invoice: {
              findFirst: jest.fn(),
              findMany: jest.fn(),
              aggregate: jest.fn(),
              count: jest.fn(),
            },
            tier: {
              findUnique: jest.fn(),
              findMany: jest.fn(),
            },
          },
        },
        {
          provide: PricingService,
          useValue: {
            calculateUsageForPeriod: jest.fn(),
            calculateCurrentPeriodCost: jest.fn(),
            getTierPricing: jest.fn(),
          },
        },
      ],
    }).compile();

    billingService = module.get<BillingService>(BillingService);
    prismaService = module.get(PrismaService);
    pricingService = module.get(PricingService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  describe('getCurrentBillingPeriod', () => {
    const mockCustomer = {
      id: 1,
      name: 'Test Customer',
      createdAt: new Date('2024-01-15T00:00:00Z'), // Use midnight for cleaner calculations
    };

    it('should calculate first billing period when no invoices exist', async () => {
      jest.useFakeTimers();
      const now = new Date('2024-02-10T10:00:00Z');
      jest.setSystemTime(now);

      prismaService.customer.findUnique.mockResolvedValue(mockCustomer);
      prismaService.invoice.findFirst.mockResolvedValue(null);

      const result = await billingService.getCurrentBillingPeriod(1);

      // The current period should be Jan 15 - Feb 15 since we're on Feb 10
      expect(result).toMatchObject({
        startDate: new Date('2024-01-15T00:00:00Z'),
        endDate: new Date('2024-02-15T00:00:00Z'),
        daysRemaining: 5,
        cycleDay: 15,
      });
    });

    it('should calculate billing period based on last invoice', async () => {
      jest.useFakeTimers();
      const now = new Date('2024-03-20T10:00:00Z');
      jest.setSystemTime(now);

      const mockLastInvoice = {
        periodStart: new Date('2024-02-15T00:00:00Z'),
        periodEnd: new Date('2024-03-15T00:00:00Z'),
      };

      prismaService.customer.findUnique.mockResolvedValue(mockCustomer);
      prismaService.invoice.findFirst.mockResolvedValue(mockLastInvoice);

      const result = await billingService.getCurrentBillingPeriod(1);

      // Allow for minor time differences due to date manipulation
      expect(result.startDate).toEqual(new Date('2024-03-16T00:00:00Z'));
      expect(result.endDate.toISOString().substring(0, 10)).toBe('2024-04-15');
      expect(result.daysRemaining).toBe(27);
      expect(result.cycleDay).toBe(15);
    });

    it('should handle month-end edge cases', async () => {
      jest.useFakeTimers();
      const now = new Date('2024-02-15T10:00:00Z');
      jest.setSystemTime(now);

      const customer31st = {
        ...mockCustomer,
        createdAt: new Date('2024-01-31T00:00:00Z'),
      };

      prismaService.customer.findUnique.mockResolvedValue(customer31st);
      prismaService.invoice.findFirst.mockResolvedValue(null);

      const result = await billingService.getCurrentBillingPeriod(1);

      expect(result.cycleDay).toBe(31);
      // February doesn't have 31 days, so it should handle this correctly
      expect(result.endDate.getMonth()).toBe(2); // March
    });

    it('should throw NotFoundException when customer does not exist', async () => {
      prismaService.customer.findUnique.mockResolvedValue(null);

      await expect(billingService.getCurrentBillingPeriod(999)).rejects.toThrow(NotFoundException);
      await expect(billingService.getCurrentBillingPeriod(999)).rejects.toThrow('Customer with ID 999 not found');
    });

    it('should handle last day of billing period', async () => {
      jest.useFakeTimers();
      const now = new Date('2024-02-14T23:00:00Z'); // Day before period ends
      jest.setSystemTime(now);

      const customerSameDay = {
        ...mockCustomer,
        createdAt: new Date('2024-01-15T00:00:00Z'),
      };

      prismaService.customer.findUnique.mockResolvedValue(customerSameDay);
      prismaService.invoice.findFirst.mockResolvedValue(null);

      const result = await billingService.getCurrentBillingPeriod(1);

      expect(result.daysRemaining).toBeLessThanOrEqual(1); // Should be 0 or 1
    });
  });

  describe('getCurrentUsageAndCost', () => {
    const mockCustomer = {
      id: 1,
      tierId: 2,
      tier: {
        id: 2,
        name: 'Pro',
        price: { toNumber: () => 99.99 },
      },
    };

    const mockBillingPeriod = {
      startDate: new Date('2024-02-01'),
      endDate: new Date('2024-03-01'),
      daysRemaining: 10,
      cycleDay: 1,
    };

    it('should return current usage and cost with percentage', async () => {
      prismaService.customer.findFirst.mockResolvedValue(mockCustomer);
      billingService.getCurrentBillingPeriod = jest.fn().mockResolvedValue(mockBillingPeriod);

      pricingService.calculateUsageForPeriod.mockResolvedValue({
        usage: 5000,
        period: { start: mockBillingPeriod.startDate, end: mockBillingPeriod.endDate },
      });

      pricingService.calculateCurrentPeriodCost.mockResolvedValue({
        price: 99.99,
        tierName: 'Pro',
      });

      pricingService.getTierPricing.mockResolvedValue({
        rateLimit: 10000,
      });

      const result = await billingService.getCurrentUsageAndCost(1);

      expect(result).toEqual({
        period: {
          startDate: mockBillingPeriod.startDate,
          endDate: mockBillingPeriod.endDate,
          daysRemaining: 10,
        },
        usage: {
          count: 5000,
          limit: 10000,
          percentage: 50,
        },
        tier: {
          name: 'Pro',
          price: 99.99,
        },
      });
    });

    it('should handle unlimited rate limit', async () => {
      prismaService.customer.findFirst.mockResolvedValue(mockCustomer);
      billingService.getCurrentBillingPeriod = jest.fn().mockResolvedValue(mockBillingPeriod);

      pricingService.calculateUsageForPeriod.mockResolvedValue({ usage: 15000 });
      pricingService.calculateCurrentPeriodCost.mockResolvedValue({ price: 99.99, tierName: 'Pro' });
      pricingService.getTierPricing.mockResolvedValue({ rateLimit: 0 }); // 0 means unlimited

      const result = await billingService.getCurrentUsageAndCost(1);

      expect(result.usage).toEqual({
        count: 15000,
        limit: 'unlimited',
        percentage: 0,
      });
    });

    it('should throw NotFoundException when customer does not exist', async () => {
      prismaService.customer.findFirst.mockResolvedValue(null);

      await expect(billingService.getCurrentUsageAndCost(999)).rejects.toThrow(NotFoundException);
      await expect(billingService.getCurrentUsageAndCost(999)).rejects.toThrow('Customer with ID 999 not found');
    });
  });

  describe('getCustomerBillingHistory', () => {
    const mockInvoices = [
      {
        id: 1,
        invoiceNumber: 'INV-2024-01-001',
        periodStart: new Date('2024-01-01'),
        periodEnd: new Date('2024-02-01'),
        amount: { toNumber: () => 99.99 },
        status: 'PAID',
        dueDate: new Date('2024-02-05'),
        paidAt: new Date('2024-02-03'),
        lineItems: [
          {
            description: 'Pro Plan - Monthly',
            quantity: 1,
            unitPrice: { toNumber: () => 99.99 },
            amount: { toNumber: () => 99.99 },
          },
        ],
      },
      {
        id: 2,
        invoiceNumber: 'INV-2024-02-001',
        periodStart: new Date('2024-02-01'),
        periodEnd: new Date('2024-03-01'),
        amount: { toNumber: () => 99.99 },
        status: 'PENDING',
        dueDate: new Date('2024-03-05'),
        paidAt: null,
        lineItems: [],
      },
    ];

    it('should return formatted billing history with total spent', async () => {
      prismaService.customer.findFirst.mockResolvedValue({ id: 1 });
      prismaService.invoice.findMany.mockResolvedValue(mockInvoices);
      prismaService.invoice.aggregate.mockResolvedValue({
        _sum: { amount: { toNumber: () => 299.97 } },
      });
      prismaService.invoice.count.mockResolvedValue(5);

      const result = await billingService.getCustomerBillingHistory(1);

      expect(result).toEqual({
        invoices: [
          {
            id: 1,
            invoiceNumber: 'INV-2024-01-001',
            period: {
              start: mockInvoices[0].periodStart,
              end: mockInvoices[0].periodEnd,
            },
            amount: 99.99,
            status: 'PAID',
            dueDate: mockInvoices[0].dueDate,
            paidAt: mockInvoices[0].paidAt,
            lineItems: [
              {
                description: 'Pro Plan - Monthly',
                quantity: 1,
                unitPrice: 99.99,
                amount: 99.99,
              },
            ],
          },
          {
            id: 2,
            invoiceNumber: 'INV-2024-02-001',
            period: {
              start: mockInvoices[1].periodStart,
              end: mockInvoices[1].periodEnd,
            },
            amount: 99.99,
            status: 'PENDING',
            dueDate: mockInvoices[1].dueDate,
            paidAt: null,
            lineItems: [],
          },
        ],
        totalSpent: 299.97,
        totalInvoices: 5,
        returnedCount: 2,
      });
    });

    it('should handle empty invoice history', async () => {
      prismaService.customer.findFirst.mockResolvedValue({ id: 1 });
      prismaService.invoice.findMany.mockResolvedValue([]);
      prismaService.invoice.aggregate.mockResolvedValue({ _sum: { amount: null } });
      prismaService.invoice.count.mockResolvedValue(0);

      const result = await billingService.getCustomerBillingHistory(1);

      expect(result).toEqual({
        invoices: [],
        totalSpent: 0,
        totalInvoices: 0,
        returnedCount: 0,
      });
    });

    it('should respect limit parameter', async () => {
      prismaService.customer.findFirst.mockResolvedValue({ id: 1 });
      prismaService.invoice.findMany.mockResolvedValue([mockInvoices[0]]);
      prismaService.invoice.aggregate.mockResolvedValue({ _sum: { amount: { toNumber: () => 99.99 } } });
      prismaService.invoice.count.mockResolvedValue(5);

      await billingService.getCustomerBillingHistory(1, 1);

      expect(prismaService.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 1,
        }),
      );
    });

    it('should throw NotFoundException when customer does not exist', async () => {
      prismaService.customer.findFirst.mockResolvedValue(null);

      await expect(billingService.getCustomerBillingHistory(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('previewTierUpgrade', () => {
    const mockCustomer = {
      id: 1,
      tierId: 1,
      tier: {
        id: 1,
        name: 'Free',
        price: { toNumber: () => 0 },
        rateLimit: 1000,
        features: { basic: true },
      },
    };

    const mockProTier = {
      id: 2,
      name: 'Pro',
      price: { toNumber: () => 99.99 },
      rateLimit: 10000,
      features: { basic: true, analytics: true, support: true },
    };

    const mockBillingPeriod = {
      startDate: new Date('2024-02-01'),
      endDate: new Date('2024-03-01'),
      daysRemaining: 15,
      cycleDay: 1,
    };

    it('should preview tier upgrade with pro-rated amount', async () => {
      prismaService.customer.findFirst.mockResolvedValue(mockCustomer);
      prismaService.tier.findUnique.mockResolvedValue(mockProTier);
      billingService.getCurrentBillingPeriod = jest.fn().mockResolvedValue(mockBillingPeriod);

      const result = await billingService.previewTierUpgrade(1, 2);

      expect(result).toEqual({
        currentTier: {
          id: 1,
          name: 'Free',
          price: 0,
          rateLimit: 1000,
          features: { basic: true },
        },
        newTier: {
          id: 2,
          name: 'Pro',
          price: 99.99,
          rateLimit: 10000,
          features: { basic: true, analytics: true, support: true },
        },
        currentPeriod: {
          proratedAmount: 51.72, // (99.99 * 15) / 29 days
          daysRemaining: 15,
          endDate: mockBillingPeriod.endDate,
          isUpgrade: true,
        },
        nextPeriod: {
          monthlyAmount: 99.99,
          startDate: new Date('2024-03-02'),
        },
        immediateChanges: {
          rateLimitChange: 9000,
          priceChange: 99.99,
          featuresAdded: ['analytics', 'support'],
          featuresRemoved: [],
        },
      });
    });

    it('should handle downgrade with negative pro-rated amount', async () => {
      const proCustomer = {
        ...mockCustomer,
        tierId: 2,
        tier: mockProTier,
      };

      const basicTier = {
        id: 3,
        name: 'Basic',
        price: { toNumber: () => 49.99 },
        rateLimit: 5000,
        features: { basic: true, analytics: true },
      };

      prismaService.customer.findFirst.mockResolvedValue(proCustomer);
      prismaService.tier.findUnique.mockResolvedValue(basicTier);
      billingService.getCurrentBillingPeriod = jest.fn().mockResolvedValue(mockBillingPeriod);

      const result = (await billingService.previewTierUpgrade(1, 3)) as any;

      expect(result.currentPeriod.proratedAmount).toBeLessThan(0);
      expect(result.currentPeriod.isUpgrade).toBe(false);
      expect(result.immediateChanges.featuresRemoved).toEqual(['support']);
    });

    it('should handle same tier selection', async () => {
      // Make sure the customer has the same tierId we're trying to upgrade to
      const customerOnFreeTier = {
        ...mockCustomer,
        tierId: 1,
        tier: {
          id: 1,
          name: 'Free',
          price: { toNumber: () => 0 },
        },
      };

      prismaService.customer.findFirst.mockResolvedValue(customerOnFreeTier);
      // Mock the tier lookup to return the same tier
      prismaService.tier.findUnique.mockResolvedValue({
        id: 1,
        name: 'Free',
        price: { toNumber: () => 0 },
      });

      const result = await billingService.previewTierUpgrade(1, 1);

      expect(result).toEqual({
        message: 'Customer is already on this tier',
        currentTier: {
          id: 1,
          name: 'Free',
          price: 0, // This will be customer.tier.price.toNumber()
        },
      });
    });

    it('should throw NotFoundException when customer does not exist', async () => {
      prismaService.customer.findFirst.mockResolvedValue(null);

      await expect(billingService.previewTierUpgrade(999, 2)).rejects.toThrow(NotFoundException);
      await expect(billingService.previewTierUpgrade(999, 2)).rejects.toThrow('Customer with ID 999 not found');
    });

    it('should throw NotFoundException when new tier does not exist', async () => {
      prismaService.customer.findFirst.mockResolvedValue(mockCustomer);
      prismaService.tier.findUnique.mockResolvedValue(null);

      await expect(billingService.previewTierUpgrade(1, 999)).rejects.toThrow(NotFoundException);
      await expect(billingService.previewTierUpgrade(1, 999)).rejects.toThrow('Tier with ID 999 not found');
    });
  });

  describe('getAvailableTiers', () => {
    const mockTiers = [
      {
        id: 1,
        name: 'Free',
        price: { toNumber: () => 0 },
        rateLimit: 1000,
        features: { basic: true },
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      },
      {
        id: 2,
        name: 'Pro',
        price: { toNumber: () => 99.99 },
        rateLimit: 10000,
        features: { basic: true, analytics: true },
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      },
    ];

    it('should return all available tiers without current customer', async () => {
      prismaService.tier.findMany.mockResolvedValue(mockTiers);

      const result = await billingService.getAvailableTiers();

      expect(result).toEqual([
        {
          id: 1,
          name: 'Free',
          price: 0,
          rateLimit: 1000,
          features: { basic: true },
          isCurrent: false,
          createdAt: mockTiers[0].createdAt,
          updatedAt: mockTiers[0].updatedAt,
        },
        {
          id: 2,
          name: 'Pro',
          price: 99.99,
          rateLimit: 10000,
          features: { basic: true, analytics: true },
          isCurrent: false,
          createdAt: mockTiers[1].createdAt,
          updatedAt: mockTiers[1].updatedAt,
        },
      ]);
    });

    it('should mark current tier when customer ID provided', async () => {
      prismaService.tier.findMany.mockResolvedValue(mockTiers);
      prismaService.customer.findUnique.mockResolvedValue({ tierId: 2 });

      const result = await billingService.getAvailableTiers(1);

      expect(result[0].isCurrent).toBe(false);
      expect(result[1].isCurrent).toBe(true);
    });

    it('should handle null features gracefully', async () => {
      const tiersWithNullFeatures = [{ ...mockTiers[0], features: null }];
      prismaService.tier.findMany.mockResolvedValue(tiersWithNullFeatures);

      const result = await billingService.getAvailableTiers();

      expect(result[0].features).toEqual({});
    });

    it('should handle customer not found when checking current tier', async () => {
      prismaService.tier.findMany.mockResolvedValue(mockTiers);
      prismaService.customer.findUnique.mockResolvedValue(null);

      const result = await billingService.getAvailableTiers(999);

      expect(result.every((tier) => !tier.isCurrent)).toBe(true);
    });
  });
});
