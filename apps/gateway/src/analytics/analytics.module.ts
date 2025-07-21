import { Module } from '@nestjs/common';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsClientService } from './analytics-client.service';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [ConfigModule, HttpModule],
  providers: [AnalyticsClientService],
  controllers: [AnalyticsController],
  exports: [AnalyticsClientService],
})
export class AnalyticsModule {}
