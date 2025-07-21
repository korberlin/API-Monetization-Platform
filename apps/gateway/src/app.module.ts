import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { ProxyModule } from './proxy/proxy.module';
import { ApiKeyMiddleware } from './middleware/api-key.middleware';
import { AdminModule } from './admin/admin.module';
import { RedisModule } from './redis/redis.module';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { CustomerModule } from './customer/customer.module';
import { JobsModule } from './jobs/jobs.module';
import { ScheduleModule } from '@nestjs/schedule';
import { AnalyticsModule } from './analytics/analytics.module';
import { BillingModule } from './billing/billing.module';
import configuration from './config/configuration';

@Module({
  imports: [
    ProxyModule,
    AdminModule,
    RedisModule,
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: '.env',
    }),
    PrismaModule,
    CustomerModule,
    JobsModule,
    ScheduleModule.forRoot(),
    AnalyticsModule,
    BillingModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(ApiKeyMiddleware)
      .exclude(
        { path: 'admin', method: RequestMethod.ALL },
        { path: 'admin/*path', method: RequestMethod.ALL },
        { path: 'dashboard.html', method: RequestMethod.GET },
        { path: 'public/(.*)', method: RequestMethod.GET },
      )
      .forRoutes('*');
  }
}
