import { ApiProperty } from '@nestjs/swagger';

export class BillingPeriodDto {
  @ApiProperty({ example: '2024-01-01T00:00:00.000Z' })
  startDate: Date;

  @ApiProperty({ example: '2024-01-31T23:59:59.999Z' })
  endDate: Date;

  @ApiProperty({ example: 31, description: 'Number of days in the billing period' })
  daysInPeriod: number;

  @ApiProperty({ example: 15, description: 'Number of days elapsed in current period' })
  daysElapsed: number;

  @ApiProperty({ example: 48.4, description: 'Percentage of period completed' })
  percentageComplete: number;
}

export class CurrentUsageDto {
  @ApiProperty({ example: 45231, description: 'Total API calls in current period' })
  totalRequests: number;

  @ApiProperty({ example: 1500, description: 'Daily average requests' })
  dailyAverage: number;

  @ApiProperty({ example: 100000, description: 'Monthly quota based on tier' })
  monthlyQuota: number;

  @ApiProperty({ example: 45.2, description: 'Percentage of quota used' })
  quotaUsedPercentage: number;

  @ApiProperty({ example: 54769, description: 'Remaining requests in quota' })
  remainingQuota: number;

  @ApiProperty({ example: 135.69, description: 'Estimated cost in USD' })
  estimatedCost: number;
}

export class BillingHistoryItemDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: '2024-01-01T00:00:00.000Z' })
  periodStart: Date;

  @ApiProperty({ example: '2024-01-31T23:59:59.999Z' })
  periodEnd: Date;

  @ApiProperty({ example: 89456, description: 'Total API calls in period' })
  totalRequests: number;

  @ApiProperty({ example: 268.37, description: 'Total cost in USD' })
  totalCost: number;

  @ApiProperty({ example: 'PAID', enum: ['PAID', 'PENDING', 'OVERDUE'] })
  status: string;

  @ApiProperty({ example: 'INV-2024-0001' })
  invoiceNumber: string;

  @ApiProperty({ example: '2024-02-01T00:00:00.000Z' })
  invoiceDate: Date;
}

export class PricingTierDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'Starter' })
  name: string;

  @ApiProperty({ example: 'Perfect for small projects and testing' })
  description: string;

  @ApiProperty({ example: 29.99, description: 'Base monthly price in USD' })
  basePrice: number;

  @ApiProperty({ example: 10000, description: 'Included requests per month' })
  includedRequests: number;

  @ApiProperty({ example: 0.003, description: 'Price per request after included quota' })
  overageRate: number;

  @ApiProperty({ example: 100, description: 'Requests per second limit' })
  rateLimitPerSecond: number;

  @ApiProperty({
    example: ['Basic analytics', 'Email support', '99.9% uptime SLA'],
    description: 'List of features included in this tier',
  })
  features: string[];

  @ApiProperty({ example: false, description: "Whether this is the customer's current tier" })
  isCurrent: boolean;
}

export class TierUpgradePreviewDto {
  @ApiProperty({ type: PricingTierDto })
  currentTier: PricingTierDto;

  @ApiProperty({ type: PricingTierDto })
  newTier: PricingTierDto;

  @ApiProperty({ example: 20.0, description: 'Pro-rated cost for upgrade' })
  proratedCost: number;

  @ApiProperty({ example: 15, description: 'Days remaining in current period' })
  daysRemaining: number;

  @ApiProperty({ example: '2024-02-01T00:00:00.000Z', description: 'When the new tier pricing takes full effect' })
  nextBillingDate: Date;

  @ApiProperty({ example: true, description: 'Whether immediate upgrade is available' })
  immediateUpgradeAvailable: boolean;
}

export class UsageHistoryItemDto {
  @ApiProperty({ example: '2024-01-15' })
  date: string;

  @ApiProperty({ example: 3421, description: 'Number of API calls on this date' })
  requests: number;

  @ApiProperty({ example: 12, description: 'Number of errors on this date' })
  errors: number;

  @ApiProperty({ example: 99.65, description: 'Success rate percentage' })
  successRate: number;

  @ApiProperty({ example: 145, description: 'Average response time in milliseconds' })
  avgResponseTime: number;
}

export class PaymentPeriodDto {
  @ApiProperty({ example: '2024-01-01T00:00:00.000Z' })
  periodStart: Date;

  @ApiProperty({ example: '2024-01-31T23:59:59.999Z' })
  periodEnd: Date;

  @ApiProperty({ example: 45231, description: 'Total requests in period' })
  totalRequests: number;

  @ApiProperty({ example: 10000, description: 'Included requests in tier' })
  includedRequests: number;

  @ApiProperty({ example: 35231, description: 'Billable overage requests' })
  billableRequests: number;

  @ApiProperty({ example: 29.99, description: 'Base tier cost' })
  baseCost: number;

  @ApiProperty({ example: 105.69, description: 'Overage charges' })
  overageCost: number;

  @ApiProperty({ example: 135.68, description: 'Total amount due' })
  totalAmount: number;

  @ApiProperty({ example: 'Starter', description: 'Current pricing tier' })
  tierName: string;
}
