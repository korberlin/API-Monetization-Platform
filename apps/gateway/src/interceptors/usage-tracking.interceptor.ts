import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { UsageLog } from 'src/interfaces/usage.interface';
import { UsageTrackingService } from 'src/proxy/services/usage-tracking.service';
@Injectable()
export class UsageTrackingInterceptor implements NestInterceptor {
  constructor(private usageTrackingService: UsageTrackingService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const startTime = Date.now();

    return next.handle().pipe(
      tap(() => {
        const responseTime = Date.now() - startTime;
        const usage: UsageLog = {
          customerId: request.customer.id,
          apiKey: request.headers['x-api-key'],
          apiKeyId: request.apiKey.id,
          endpoint: request.url,
          method: request.method,
          statusCode: context.switchToHttp().getResponse().statusCode,
          responseTime,
          timestamp: new Date(),
        };
        this.usageTrackingService.addUsageLog(usage);
      }),
    );
  }
}
