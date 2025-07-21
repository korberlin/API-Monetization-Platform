import { Module } from '@nestjs/common';
import { CustomerService } from './customer.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { RedisModule } from 'src/redis/redis.module';

@Module({
  imports: [PrismaModule, RedisModule],
  providers: [CustomerService],
  exports: [CustomerService],
})
export class CustomerModule {}
