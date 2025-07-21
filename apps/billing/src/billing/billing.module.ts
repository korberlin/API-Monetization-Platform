import { Module } from '@nestjs/common';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { PricingModule } from 'src/pricing/pricing.module';

@Module({
  imports: [PrismaModule, PricingModule],
  controllers: [BillingController],
  providers: [BillingService],
  exports: [BillingService],
})
export class BillingModule {}
