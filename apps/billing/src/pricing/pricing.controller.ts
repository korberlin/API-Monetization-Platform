import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { PricingService } from './pricing.service';

@Controller('pricing')
export class PricingController {
  constructor(private pricingService: PricingService) {}
  @Get(':customerId')
  getCurrentPaymentPeriod(@Param('customerId', ParseIntPipe) customerId: number) {
    return this.pricingService.calculateCurrentPeriodCost(customerId);
  }
  @Get('usage-history/:customerId')
  getUsageForPeriod(
    @Param('customerId', ParseIntPipe) customerId: number,
    @Query('period') startDate: Date,
    endDate: Date,
  ) {
    return this.pricingService.calculateUsageForPeriod(customerId, startDate, endDate);
  }
}
