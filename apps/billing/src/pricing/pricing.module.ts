import { Module } from '@nestjs/common';
import { PricingService } from './pricing.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { PricingController } from './pricing.controller';

@Module({
  imports: [PrismaModule],
  controllers: [PricingController],
  providers: [PricingService],
  exports: [PricingService],
})
export class PricingModule {}
