import { CustomerService } from './../customer/customer.service';
import { RateLimitService } from '../proxy/services/rate-limit.service';
import { UnauthorizedException, Injectable, NestMiddleware, HttpException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
declare module 'express-serve-static-core' {
  interface Request {
    customer?: any;
    developer?: any;
    apiKey?: any;
  }
}

@Injectable()
export class ApiKeyMiddleware implements NestMiddleware {
  constructor(
    private rateLimitService: RateLimitService,
    private customerService: CustomerService,
  ) {}
  async use(req: Request, res: Response, next: NextFunction) {
    const apiKey = req.headers['x-api-key'] as string;
    if (!apiKey) {
      throw new UnauthorizedException('Missing API key');
    }
    // validate API key
    const apiKeyData = await this.customerService.findByApiKey(apiKey);
    if (!apiKeyData) {
      throw new UnauthorizedException('Invalid API key');
    }
    console.log(apiKeyData);
    // get developer info
    const developer = apiKeyData.developer;
    // add request for use in controller/service

    // check rate limit is exceeded or not and set headers
    const { allowed, remaining, resetAt } = await this.rateLimitService.checkAndIncrement(
      apiKeyData.customer.id.toString(),
      apiKeyData.customer.tier.rateLimit,
    );
    res.setHeader('X-RateLimit-Limit', apiKeyData.customer.tier.rateLimit.toString());
    res.setHeader('X-RateLimit-Remaining', remaining.toString());
    res.setHeader('X-RateLimit-Reset', resetAt || new Date().toDateString());

    if (!allowed) {
      throw new HttpException('Rate limit exceeded', 429);
    }
    req.customer = apiKeyData.customer;
    req.developer = developer;
    req.apiKey = apiKeyData.apiKey;

    next();
  }
}
