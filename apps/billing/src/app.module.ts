import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule } from '@nestjs/config';
import { Module } from '@nestjs/common';
import { BillingModule } from './billing/billing.module';
import { PricingModule } from './pricing/pricing.module';
import { PrismaModule } from './prisma/prisma.module';
import { InvoiceModule } from './invoice/invoice.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    BillingModule,
    PricingModule,
    PrismaModule,
    InvoiceModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
