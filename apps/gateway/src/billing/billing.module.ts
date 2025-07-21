import { Module } from '@nestjs/common';
import { BillingController } from './billing.controller';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { BillingClientService } from './billing-client.service';

@Module({
  imports: [ConfigModule, HttpModule],
  providers: [BillingClientService],
  controllers: [BillingController],
  exports: [BillingClientService],
})
export class BillingModule {}
