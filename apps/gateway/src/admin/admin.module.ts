import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { ProxyModule } from 'src/proxy/proxy.module';
import { CustomerModule } from 'src/customer/customer.module';
import { PrismaModule } from 'src/prisma/prisma.module';
import { BillingModule } from 'src/billing/billing.module';

@Module({
  imports: [PrismaModule, ProxyModule, CustomerModule, BillingModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
