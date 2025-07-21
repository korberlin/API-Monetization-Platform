import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class PricingService {
  constructor(private prismaService: PrismaService) {}

  async calculateCurrentPeriodCost(customerId: number) {
    const customer = await this.prismaService.customer.findFirst({
      where: {
        id: customerId,
      },
      include: {
        tier: true,
      },
    });
    if (!customer) {
      throw new NotFoundException('No customer found');
    }
    return {
      price: customer.tier.price,
      tierName: customer.tier.name,
      customerId: customer.id,
      period: 'monthly',
    };
  }

  async getTierPricing(tierId: number) {
    const tier = await this.prismaService.tier.findFirst({
      where: {
        id: tierId,
      },
    });
    if (!tier) {
      throw new NotFoundException('No tier found');
    }
    return {
      id: tier.id,
      name: tier.name,
      price: tier.price.toNumber(),
      rateLimit: tier.rateLimit,
      features: tier.features,
    };
  }
  async calculateUsageForPeriod(customerId: number, startDate: Date, endDate: Date) {
    const usageCount = await this.prismaService.usageHistory.count({
      where: {
        customerId: customerId,
        timestamp: {
          gte: startDate,
          lt: endDate,
        },
      },
    });
    return {
      customerId,
      usage: usageCount,
      period: {
        start: startDate,
        end: endDate,
      },
    };
  }
  async estimateMonthlyCost(customerId: number, newTierId?: number) {
    const customer = await this.prismaService.customer.findUnique({
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
    let comparisonTier = customer.tier;
    if (newTierId) {
      const newTier = await this.prismaService.tier.findUnique({
        where: {
          id: newTierId,
        },
      });
      if (!newTier) {
        throw new NotFoundException(`Tier with ID ${newTierId} not found`);
      }
      comparisonTier = newTier;
    }

    const currentPrice = customer.tier.price.toNumber();
    const newPrice = comparisonTier.price.toNumber();

    const result = {
      currentTier: customer.tier.name,
      currentPrice: currentPrice,
    };

    // only add comparison data if a different tier was requested
    if (newTierId && comparisonTier.id !== customer.tier.id) {
      return {
        ...result,
        newTier: comparisonTier.name,
        newPrice: newPrice,
        savings: currentPrice > newPrice ? Math.round((currentPrice - newPrice) * 100) / 100 : 0,
        additionalCost: newPrice > currentPrice ? newPrice - currentPrice : 0,
      };
    }
    return result;
  }
}
