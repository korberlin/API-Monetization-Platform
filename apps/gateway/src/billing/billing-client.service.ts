import { HttpService } from '@nestjs/axios';
import { Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AxiosError } from 'axios';
import { firstValueFrom } from 'rxjs';
import {
  CreateInvoiceDto,
  GenerateInvoicesDto,
  InvoiceQueryDto,
  UpdateInvoiceStatusDto,
} from './dtos/create-invoice.dto';

@Injectable()
export class BillingClientService {
  private billingUrl: string;
  private readonly logger = new Logger(BillingClientService.name);

  constructor(
    private httpService: HttpService,
    private configService: ConfigService,
  ) {
    this.billingUrl = this.configService.get('billing.url') ?? '';
  }

  private handleError(error: any, method: string) {
    if (error instanceof AxiosError) {
      this.logger.error(`Billing service error in ${method}: ${error.message}`);
      if (error.response?.status === 404) {
        throw new NotFoundException('Resource not found in billing service');
      }
      throw new ServiceUnavailableException('Billing service is currently unavailable');
    }
    throw error;
  }

  // Pricing endpoints
  async getCurrentPaymentPeriod(customerId: number) {
    try {
      const response = await firstValueFrom(this.httpService.get(`${this.billingUrl}/pricing/${customerId}`));
      return response.data;
    } catch (error) {
      this.handleError(error, 'getCurrentPaymentPeriod');
    }
  }

  async getUsageForPeriod(customerId: number, startDate: Date, endDate: Date) {
    try {
      const params = { startDate: startDate.toISOString(), endDate: endDate.toISOString() };
      const response = await firstValueFrom(
        this.httpService.get(`${this.billingUrl}/pricing/usage-history/${customerId}`, { params }),
      );
      return response.data;
    } catch (error) {
      this.handleError(error, 'getUsageForPeriod');
    }
  }

  // Billing endpoints
  async getCurrentBillingPeriod(customerId: number) {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.billingUrl}/billing/current-period/${customerId}`),
      );
      return response.data;
    } catch (error) {
      this.handleError(error, 'getCurrentBillingPeriod');
    }
  }

  async getCurrentUsage(customerId: number) {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.billingUrl}/billing/current-usage/${customerId}`),
      );
      return response.data;
    } catch (error) {
      this.handleError(error, 'getCurrentUsage');
    }
  }

  async getBillingHistory(customerId: number, limit?: number) {
    try {
      const params = limit ? { limit } : {};
      const response = await firstValueFrom(
        this.httpService.get(`${this.billingUrl}/billing/history/${customerId}`, { params }),
      );
      return response.data;
    } catch (error) {
      this.handleError(error, 'getBillingHistory');
    }
  }

  async getAvailableTiers(customerId?: number) {
    try {
      const params = customerId ? { customerId } : {};
      const response = await firstValueFrom(this.httpService.get(`${this.billingUrl}/billing/tiers`, { params }));
      return response.data;
    } catch (error) {
      this.handleError(error, 'getAvailableTiers');
    }
  }

  async previewTierUpgrade(customerId: number, newTierId: number) {
    try {
      const response = await firstValueFrom(
        this.httpService.post(`${this.billingUrl}/billing/preview-upgrade`, { customerId, newTierId }),
      );
      return response.data;
    } catch (error) {
      this.handleError(error, 'previewTierUpgrade');
    }
  }

  async generateInvoice(dto: CreateInvoiceDto) {
    try {
      const response = await firstValueFrom(this.httpService.post(`${this.billingUrl}/invoices`, dto));
      return response.data;
    } catch (error) {
      this.handleError(error, 'createInvoice');
    }
  }

  async getInvoiceSummary(customerId?: number) {
    try {
      const config = customerId ? { params: { customerId } } : {};
      const response = await firstValueFrom(this.httpService.get(`${this.billingUrl}/invoices/summary`, config));
      return response.data;
    } catch (error) {
      this.handleError(error, 'getInvoiceSummary');
    }
  }

  async getInvoice(id: number) {
    try {
      const response = await firstValueFrom(this.httpService.get(`${this.billingUrl}/invoices/${id}`));
      return response.data;
    } catch (error) {
      this.handleError(error, 'getInvoice');
    }
  }

  async updateInvoiceStatus(id: number, dto: UpdateInvoiceStatusDto) {
    try {
      const response = await firstValueFrom(this.httpService.put(`${this.billingUrl}/invoices/${id}/status`, dto));
      return response.data;
    } catch (error) {
      this.handleError(error, 'updateInvoiceStatus');
    }
  }

  async markInvoiceAsPaid(id: number) {
    try {
      const response = await firstValueFrom(this.httpService.put(`${this.billingUrl}/invoices/${id}/mark-paid`, {}));
      return response.data;
    } catch (error) {
      this.handleError(error, 'markInvoiceAsPaid');
    }
  }

  async queryInvoices(query: InvoiceQueryDto) {
    try {
      const params: any = {};
      if (query.customerId) params.customerId = query.customerId;
      if (query.status) params.status = query.status;
      if (query.startDate) params.startDate = query.startDate;
      if (query.endDate) params.endDate = query.endDate;
      if (query.limit) params.limit = query.limit;
      if (query.offset) params.offset = query.offset;

      const response = await firstValueFrom(this.httpService.get(`${this.billingUrl}/invoices`, { params }));
      return response.data;
    } catch (error) {
      this.handleError(error, 'queryInvoices');
    }
  }

  async generateMonthlyInvoices(dto: GenerateInvoicesDto) {
    try {
      const body = { ...dto };
      if (body.billingDate instanceof Date) {
        body.billingDate = body.billingDate.toISOString();
      }
      const filteredBody = Object.fromEntries(Object.entries(body).filter(([_, v]) => v !== undefined));
      console.log('Sending POST with:', filteredBody);
      const response = await firstValueFrom(
        this.httpService.post(`${this.billingUrl}/invoices/generate-monthly`, filteredBody, { timeout: 10000 }),
      );
      return response.data;
    } catch (error) {
      console.error('Full error object:', error);
      this.handleError(error, 'generateMonthlyInvoices');
    }
  }

  async markOverdueInvoices() {
    try {
      const response = await firstValueFrom(this.httpService.post(`${this.billingUrl}/invoices/mark-overdue`, {}));
      return response.data;
    } catch (error) {
      this.handleError(error, 'markOverdueInvoices');
    }
  }
}
