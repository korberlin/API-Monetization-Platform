import { HttpService } from '@nestjs/axios';
import { Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AxiosError } from 'axios';
import { Request } from 'express';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class AnalyticsClientService {
  private readonly logger = new Logger(AnalyticsClientService.name);
  private analyticsUrl: string;

  constructor(
    private httpService: HttpService,
    private configService: ConfigService,
  ) {
    this.analyticsUrl = this.configService.get('analytics.url') ?? '';
  }
  private handleError(error: any, method: string) {
    if (error instanceof AxiosError) {
      this.logger.error(`Analytics service error in ${method}: ${error.message}`);
      if (error.response?.status === 404) {
        throw new NotFoundException('Resource not found in analytics service');
      }
      throw new ServiceUnavailableException('Analytics service is currently unavailable');
    }
    throw error;
  }

  async getCustomerDashboard(customerId: number) {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.analyticsUrl}/analytics/${customerId}/dashboard`),
      );
      return response.data;
    } catch (error) {
      this.handleError(error, 'getCustomerdashboard');
    }
  }

  async getUsageTrends(customerId: number, period?: string) {
    try {
      const params = period ? { period } : {};
      const response = await firstValueFrom(
        this.httpService.get(`${this.analyticsUrl}/analytics/${customerId}/trends`, { params }),
      );
      return response.data;
    } catch (error) {
      this.handleError(error, 'getUsageTrends');
    }
  }

  async getEndpointAnalysis(customerId: number, period?: string) {
    try {
      const params = period ? { period } : {};
      const response = await firstValueFrom(
        this.httpService.get(`${this.analyticsUrl}/analytics/${customerId}/endpoints`, { params }),
      );
      return response.data;
    } catch (error) {
      this.handleError(error, 'getEndpointAnalysis');
    }
  }

  async getSystemHealth(customerId: number, period?: string) {
    try {
      const params = period ? { period } : {};
      const response = await firstValueFrom(
        this.httpService.get(`${this.analyticsUrl}/analytics/${customerId}/health`, { params }),
      );
      return response.data;
    } catch (error) {
      this.handleError(error, 'getSystemHealth');
    }
  }

  async getGrowthMetrics(customerId: number) {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.analyticsUrl}/analytics/${customerId}/growth`),
      );
      return response.data;
    } catch (error) {
      this.handleError(error, 'getGrowthMetrics');
    }
  }

  async getUsageCount(customerId: number, period: string) {
    try {
      const params = period ? { period } : {};
      const response = await firstValueFrom(
        this.httpService.get(`${this.analyticsUrl}/analytics/${customerId}/usage`, { params }),
      );
      return response.data;
    } catch (error) {
      this.handleError(error, 'getUsageCount');
    }
  }
}
