import { Controller, Get, Post, Param, Query, Body, ParseIntPipe } from '@nestjs/common';
import { BillingService } from './billing.service';

@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Get('current-period/:customerId')
  getCurrentPeriod(@Param('customerId', ParseIntPipe) customerId: number) {
    return this.billingService.getCurrentBillingPeriod(customerId);
  }

  @Get('current-usage/:customerId')
  getCurrentUsage(@Param('customerId', ParseIntPipe) customerId: number) {
    return this.billingService.getCurrentUsageAndCost(customerId);
  }

  @Get('history/:customerId')
  getBillingHistory(
    @Param('customerId', ParseIntPipe) customerId: number,
    @Query('limit', ParseIntPipe) limit?: number,
  ) {
    return this.billingService.getCustomerBillingHistory(customerId, limit);
  }

  @Get('tiers')
  getAvailableTiers(@Query('customerId', ParseIntPipe) customerId?: number) {
    return this.billingService.getAvailableTiers(customerId);
  }

  @Post('preview-upgrade')
  previewUpgrade(@Body() body: { customerId: number; newTierId: string }) {
    const newTierIdNum = parseInt(body.newTierId, 10);
    return this.billingService.previewTierUpgrade(body.customerId, newTierIdNum);
  }
}
