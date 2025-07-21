import { Injectable, NotFoundException } from '@nestjs/common';
import { PricingService } from 'src/pricing/pricing.service';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class BillingService {
  constructor(
    private prismaService: PrismaService,
    private pricingService: PricingService,
  ) {}

  async getCurrentBillingPeriod(customerId: number) {
    const customer = await this.prismaService.customer.findUnique({
      where: {
        id: customerId,
      },
    });

    if (!customer) {
      throw new NotFoundException(`Customer with ID ${customerId} not found`);
    }

    // Get latest invoice
    const lastInvoice = await this.prismaService.invoice.findFirst({
      where: {
        customerId: customerId,
      },
      orderBy: {
        periodEnd: 'desc',
      },
      select: {
        periodStart: true,
        periodEnd: true,
      },
    });

    const now = new Date();
    let periodStart: Date;
    let periodEnd: Date = new Date();

    // maximum iterations to prevent infinite loops
    const MAX_ITERATIONS = 120; // 10 years worth of months
    let iterations = 0;

    if (!lastInvoice) {
      periodStart = new Date(customer.createdAt);

      // Validate the date is reasonable
      if (periodStart.getFullYear() > now.getFullYear() + 100) {
        throw new Error(`Invalid customer creation date: ${periodStart}. Please check your database.`);
      }

      while (iterations < MAX_ITERATIONS) {
        periodEnd = new Date(periodStart);
        periodEnd.setMonth(periodEnd.getMonth() + 1);

        if (now >= periodStart && now < periodEnd) {
          break;
        }

        if (periodStart > now) {
          throw new Error(`Billing period calculation error: start date ${periodStart} is in the future`);
        }
        periodStart = new Date(periodEnd);
        iterations++;
      }
    } else {
      if (lastInvoice.periodEnd.getFullYear() > now.getFullYear() + 100) {
        throw new Error(`Invalid invoice period end date: ${lastInvoice.periodEnd}. Please check your database.`);
      }

      if (lastInvoice.periodEnd > now) {
        periodStart = new Date(customer.createdAt);
        while (iterations < MAX_ITERATIONS) {
          periodEnd = new Date(periodStart);
          periodEnd.setMonth(periodEnd.getMonth() + 1);

          if (now >= periodStart && now < periodEnd) {
            break;
          }

          periodStart = new Date(periodEnd);
          iterations++;
        }
      } else {
        periodStart = new Date(lastInvoice.periodEnd);
        periodStart.setDate(periodStart.getDate() + 1);

        while (iterations < MAX_ITERATIONS) {
          periodEnd = new Date(periodStart);
          periodEnd.setMonth(periodEnd.getMonth() + 1);

          if (now >= periodStart && now < periodEnd) {
            break;
          }

          if (periodStart.getFullYear() > now.getFullYear() + 10) {
            throw new Error(`Billing calculation went too far into future: ${periodStart}`);
          }

          periodStart = new Date(periodEnd);
          iterations++;
        }
      }
    }

    if (iterations >= MAX_ITERATIONS) {
      throw new Error(`Failed to calculate billing period after ${MAX_ITERATIONS} iterations`);
    }

    const daysRemaining = Math.ceil((periodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    // Determine the cycle day (day of month when billing period typically resets)
    let cycleDay: number;
    
    if (!lastInvoice) {
      // For new customers, use the day they were created
      cycleDay = customer.createdAt.getDate();
    } else {
      // For existing customers, use the pattern from their invoices
      // The cycle day is the day of month when periods typically end
      cycleDay = lastInvoice.periodEnd.getDate();
    }

    return {
      periodStart,
      periodEnd,
      startDate: periodStart, // Add alias for compatibility
      endDate: periodEnd,     // Add alias for compatibility
      daysRemaining,
      cycleDay,
    };
  }

  async getCurrentUsageAndCost(customerId: number) {
    const customer = await this.prismaService.customer.findFirst({
      where: {
        id: customerId,
      },
      include: {
        tier: true,
      },
    });

    if (!customer) {
      throw new NotFoundException(`Customer with ID ${customerId} not found`);
    }

    const currentPeriod = await this.getCurrentBillingPeriod(customerId);
    const usageForPeriod = await this.pricingService.calculateUsageForPeriod(
      customerId,
      currentPeriod.startDate,
      currentPeriod.endDate,
    );
    const currentPeriodCost = await this.pricingService.calculateCurrentPeriodCost(customerId);
    const tierPricing = await this.pricingService.getTierPricing(customer.tierId);

    // Handle unlimited rate limits
    const usagePercentage =
      tierPricing.rateLimit > 0 ? Math.round((usageForPeriod.usage / tierPricing.rateLimit) * 100) : 0; // 0% for unlimited

    return {
      period: {
        startDate: currentPeriod.startDate,
        endDate: currentPeriod.endDate,
        daysRemaining: currentPeriod.daysRemaining,
      },
      usage: {
        count: usageForPeriod.usage,
        limit: tierPricing.rateLimit || 'unlimited',
        percentage: usagePercentage,
      },
      tier: {
        name: currentPeriodCost.tierName,
        price: currentPeriodCost.price,
      },
    };
  }

  async getCustomerBillingHistory(customerId: number, limit?: number) {
    const customer = await this.prismaService.customer.findFirst({
      where: {
        id: customerId,
      },
    });

    if (!customer) {
      throw new NotFoundException(`Customer with ID ${customerId} not found`);
    }

    // Get invoices with line items
    const invoices = await this.prismaService.invoice.findMany({
      where: {
        customerId: customerId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
      include: {
        lineItems: true,
      },
    });

    // Calculate total spent
    const totalSpent = await this.prismaService.invoice.aggregate({
      where: {
        customerId: customerId,
        status: 'PAID',
      },
      _sum: {
        amount: true,
      },
    });

    // Format the response
    const formattedInvoices = invoices.map((invoice) => ({
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      period: {
        start: invoice.periodStart,
        end: invoice.periodEnd,
      },
      amount: invoice.amount.toNumber(),
      status: invoice.status,
      dueDate: invoice.dueDate,
      paidAt: invoice.paidAt,
      lineItems: invoice.lineItems.map((item) => ({
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice.toNumber(),
        amount: item.amount.toNumber(),
      })),
    }));

    return {
      invoices: formattedInvoices,
      totalSpent: totalSpent._sum.amount?.toNumber() || 0,
      totalInvoices: await this.prismaService.invoice.count({
        where: { customerId },
      }),
      returnedCount: formattedInvoices.length,
    };
  }

  async previewTierUpgrade(customerId: number, newTierId: number) {
    const customer = await this.prismaService.customer.findFirst({
      where: {
        id: customerId,
      },
      include: {
        tier: true,
      },
    });

    if (!customer) {
      throw new NotFoundException(`Customer with ID ${customerId} not found`);
    }

    // Get new tier details
    const newTier = await this.prismaService.tier.findUnique({
      where: {
        id: newTierId,
      },
    });

    if (!newTier) {
      throw new NotFoundException(`Tier with ID ${newTierId} not found`);
    }

    // Check if it's the same tier
    if (customer.tierId === newTierId) {
      return {
        message: 'Customer is already on this tier',
        currentTier: {
          id: customer.tier.id,
          name: customer.tier.name,
          price: customer.tier.price.toNumber(),
        },
      };
    }

    // Get current billing period
    const currentPeriod = await this.getCurrentBillingPeriod(customerId);

    // Calculate pro-rated amount
    const totalDaysInPeriod = Math.ceil(
      (currentPeriod.endDate.getTime() - currentPeriod.startDate.getTime()) / (1000 * 60 * 60 * 24),
    );
    const daysRemaining = currentPeriod.daysRemaining;

    const currentPrice = customer.tier.price.toNumber();
    const newPrice = newTier.price.toNumber();
    const priceDifference = newPrice - currentPrice;

    // Pro-rated amount for the remaining days
    const proratedAmount = (priceDifference * daysRemaining) / totalDaysInPeriod;

    // Parse features JSON for comparison
    const currentFeatures = (customer.tier.features as any) || {};
    const newFeatures = (newTier.features as any) || {};

    return {
      currentTier: {
        id: customer.tier.id,
        name: customer.tier.name,
        price: currentPrice,
        rateLimit: customer.tier.rateLimit,
        features: currentFeatures,
      },
      newTier: {
        id: newTier.id,
        name: newTier.name,
        price: newPrice,
        rateLimit: newTier.rateLimit,
        features: newFeatures,
      },
      currentPeriod: {
        proratedAmount: Math.round(proratedAmount * 100) / 100, // Round to cents
        daysRemaining: daysRemaining,
        endDate: currentPeriod.endDate,
        isUpgrade: proratedAmount > 0,
      },
      nextPeriod: {
        monthlyAmount: newPrice,
        startDate: new Date(currentPeriod.endDate.getTime() + 24 * 60 * 60 * 1000),
      },
      immediateChanges: {
        rateLimitChange: newTier.rateLimit - customer.tier.rateLimit,
        priceChange: priceDifference,
        featuresAdded: Object.keys(newFeatures).filter((key) => !currentFeatures[key]),
        featuresRemoved: Object.keys(currentFeatures).filter((key) => !newFeatures[key]),
      },
    };
  }

  async getAvailableTiers(currentCustomerId?: number) {
    const tiers = await this.prismaService.tier.findMany({
      orderBy: {
        price: 'asc',
      },
    });

    // Get current customer tier if ID provided
    let currentTierId: number | null = null;
    if (currentCustomerId) {
      const customer = await this.prismaService.customer.findUnique({
        where: { id: currentCustomerId },
        select: { tierId: true },
      });
      currentTierId = customer?.tierId || null;
    }

    // Format tiers for response
    return tiers.map((tier) => ({
      id: tier.id,
      name: tier.name,
      price: tier.price.toNumber(),
      rateLimit: tier.rateLimit,
      features: tier.features || {},
      isCurrent: tier.id === currentTierId,
      createdAt: tier.createdAt,
      updatedAt: tier.updatedAt,
    }));
  }
}
