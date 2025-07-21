import { Module } from '@nestjs/common';
import { JobsService } from './jobs.service';
import { RedisModule } from 'src/redis/redis.module';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  imports: [RedisModule, PrismaModule],
  providers: [JobsService],
  exports: [JobsModule],
})
export class JobsModule {}
