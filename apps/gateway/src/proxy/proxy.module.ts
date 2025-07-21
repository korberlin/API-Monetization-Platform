import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ProxyService } from './services/proxy.service';
import { ProxyController } from './proxy.controller';
import { RateLimitService } from './services/rate-limit.service';
import { UsageTrackingService } from './services/usage-tracking.service';
import { RedisModule } from 'src/redis/redis.module';

@Module({
  imports: [HttpModule, RedisModule],
  controllers: [ProxyController],
  providers: [ProxyService, RateLimitService, UsageTrackingService],
  exports: [ProxyService, RateLimitService, UsageTrackingService],
})
export class ProxyModule {}
