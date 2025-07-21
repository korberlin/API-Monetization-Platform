import { Controller, All, Req, UseInterceptors } from '@nestjs/common';
import { ProxyService } from './services/proxy.service';
import { Request } from 'express';
import { UsageTrackingInterceptor } from 'src/interceptors/usage-tracking.interceptor';
import { ApiTags, ApiOperation, ApiResponse, ApiSecurity, ApiExcludeEndpoint, ApiProperty } from '@nestjs/swagger';

// Response DTO for proxy endpoints
export class ProxyResponseDto {
  @ApiProperty({
    example: { data: 'Response from target API' },
    description: 'The response from the proxied API endpoint',
  })
  data: any;

  @ApiProperty({
    example: 200,
    description: 'HTTP status code from the target API',
  })
  statusCode: number;

  @ApiProperty({
    example: { 'content-type': 'application/json' },
    description: 'Response headers from the target API',
  })
  headers: Record<string, string>;
}

@ApiTags('Proxy')
@ApiSecurity('api-key')
@Controller('api')
export class ProxyController {
  constructor(private proxyService: ProxyService) {}

  @All()
  @UseInterceptors(UsageTrackingInterceptor)
  @ApiOperation({
    summary: 'Proxy root API requests',
    description: `
      Forwards requests to the configured target API (httpbin.org by default).
      All requests through this endpoint are:
      - Authenticated via API key
      - Rate limited based on your pricing tier
      - Tracked for usage and billing
      - Monitored for analytics
      
      This endpoint handles requests to /api (without additional path)
    `,
  })
  @ApiResponse({
    status: 200,
    description: 'Successful response from target API',
    schema: {
      type: 'object',
      example: {
        args: {},
        headers: {
          'X-Forwarded-For': '127.0.0.1',
          'X-Forwarded-Host': 'httpbin.org',
        },
        origin: '127.0.0.1',
        url: 'https://httpbin.org/get',
      },
    },
  })
  @ApiResponse({
    status: 429,
    description: 'Rate limit exceeded',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 429 },
        message: { type: 'string', example: 'Rate limit exceeded' },
        retryAfter: { type: 'number', example: 60 },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid or missing API key',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 401 },
        message: { type: 'string', example: 'Invalid API key' },
      },
    },
  })
  @ApiResponse({
    status: 402,
    description: 'Payment required - quota exceeded',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 402 },
        message: { type: 'string', example: 'Monthly quota exceeded. Please upgrade your plan.' },
        quotaUsed: { type: 'number', example: 100000 },
        quotaLimit: { type: 'number', example: 100000 },
      },
    },
  })
  forwardBaseRequests(@Req() request: Request) {
    return this.proxyService.forwardRequests(request);
  }

  @All('*')
  @UseInterceptors(UsageTrackingInterceptor)
  @ApiOperation({
    summary: 'Proxy API requests with path',
    description: `
      Forwards all requests to the configured target API (httpbin.org by default).
      All requests through this endpoint are:
      - Authenticated via API key
      - Rate limited based on your pricing tier
      - Tracked for usage and billing
      - Monitored for analytics
      
      **Supported HTTP Methods**: GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS
      
      **Path Examples**:
      - /api/get → https://httpbin.org/get
      - /api/post → https://httpbin.org/post
      - /api/users/123 → https://httpbin.org/users/123
      
      **Headers**: All headers are forwarded except:
      - X-API-Key (used for authentication)
      - Host (replaced with target host)
      
      **Request Body**: Fully supported for POST, PUT, PATCH methods
      
      **Query Parameters**: All query parameters are forwarded
    `,
  })
  @ApiResponse({
    status: 200,
    description: 'Successful response from target API',
    schema: {
      type: 'object',
      example: {
        args: { param1: 'value1' },
        data: '{"key": "value"}',
        files: {},
        form: {},
        headers: {
          'Content-Type': 'application/json',
          'X-Forwarded-For': '127.0.0.1',
        },
        json: { key: 'value' },
        method: 'POST',
        origin: '127.0.0.1',
        url: 'https://httpbin.org/post?param1=value1',
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Endpoint not found on target API',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 404 },
        message: { type: 'string', example: 'Not Found' },
      },
    },
  })
  @ApiResponse({
    status: 500,
    description: 'Target API error',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 500 },
        message: { type: 'string', example: 'Internal server error from target API' },
      },
    },
  })
  @ApiResponse({
    status: 502,
    description: 'Bad gateway - target API unreachable',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 502 },
        message: { type: 'string', example: 'Target API is unreachable' },
      },
    },
  })
  @ApiResponse({
    status: 504,
    description: 'Gateway timeout - target API took too long to respond',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 504 },
        message: { type: 'string', example: 'Target API timeout' },
        timeout: { type: 'number', example: 30000 },
      },
    },
  })
  forwardRequests(@Req() request: Request) {
    return this.proxyService.forwardRequests(request);
  }
}
