import { HttpService } from '@nestjs/axios';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { lastValueFrom } from 'rxjs';
import { Request } from 'express';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ProxyService {
  constructor(
    private httpService: HttpService,
    private configService: ConfigService,
  ) {}

  private cleanHeaders(headers: any): object {
    const headersToRemove = [
      'host',
      'x-api-key',
      'x-forwarded-for', // to not leak proxy chain
      'x-real-ip', // to not leak customer ip
      'connection', // HTTP/2 vs HTTP/1.1 handling
      'content-length',
      'content-type',
    ];
    const sanitizedHeaders = Object.entries(headers)
      .filter(([key]) => !headersToRemove.includes(key.toLowerCase()))
      .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {});
    return sanitizedHeaders;
  }

  async forwardRequests(req: Request) {
    const body = req.body as Record<string, any> | undefined;
    const { method, headers } = req;
    const { developer, customer } = req;

    // building complete URL with query params
    const urlPath = req.url.replace(/^\/api/, '') || '/';
    const targetUrl = `${this.configService.get('api.targetUrl')}${urlPath}` || `https://httpbin.org${urlPath}`;
    console.log(`Customer ${customer.email} (${customer.tier.name}) calling ${targetUrl}`);
    // clean headers
    const sanitizedHeaders = this.cleanHeaders(headers);

    const config = {
      headers: sanitizedHeaders,
      timeout: 30000, // 30 secs
    };

    try {
      let response;

      switch (method) {
        case 'GET':
          response = await lastValueFrom(this.httpService.get(targetUrl, config));
          break;
        case 'POST':
          response = await lastValueFrom(this.httpService.post(targetUrl, body, config));
          break;
        case 'PUT':
          response = await lastValueFrom(this.httpService.put(targetUrl, body, config));
          break;
        case 'DELETE':
          response = await lastValueFrom(this.httpService.delete(targetUrl, config));
          break;
        default:
          throw new Error(`Method ${method} not supported`);
      }
      return response.data;
    } catch (error: any) {
      if (error.response) {
        // forward the error from target API
        throw new HttpException(error.response.data, error.response.status);
      }
      // gateway error
      throw new HttpException('Gateway error', HttpStatus.BAD_GATEWAY);
    }
  }
}
