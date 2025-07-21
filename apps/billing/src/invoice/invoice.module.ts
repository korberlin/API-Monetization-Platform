import { Module } from '@nestjs/common';
import { InvoiceService } from './invoice.service';
import { InvoiceController } from './invoice.controller';
import { PrismaModule } from 'src/prisma/prisma.module';
import { BillingModule } from 'src/billing/billing.module';
import { PricingModule } from 'src/pricing/pricing.module';
import { InvoiceProcessor } from './invoice.processor';

@Module({
  imports: [PrismaModule, BillingModule, PricingModule],
  controllers: [InvoiceController],
  providers: [InvoiceService, InvoiceProcessor],
  exports: [InvoiceService],
})
export class InvoiceModule {}
