// apps/gateway/src/admin/admin.controller.ts

import { CustomerService } from './../customer/customer.service';
import { Controller, Get, Param, UseGuards, Post, Body, ValidationPipe, Query } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminGuard } from 'src/guards/admin.guard';
import { BillingClientService } from '../billing/billing-client.service';
import { GenerateInvoicesDto, InvoiceQueryDto } from '../billing/dtos/create-invoice.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiSecurity, ApiParam, ApiQuery, ApiBody } from '@nestjs/swagger';

@ApiTags('Admin')
@ApiSecurity('admin-key')
@UseGuards(AdminGuard)
@Controller('admin')
export class AdminController {
  constructor(
    private adminService: AdminService,
    private customerService: CustomerService,
    private billingService: BillingClientService,
  ) {}

  @Get('stats')
  @ApiOperation({
    summary: 'Get system-wide statistics',
    description: 'Returns overall platform statistics including all customer usage and rate limits',
  })
  @ApiResponse({
    status: 200,
    description: 'System statistics',
    schema: {
      example: {
        '1': { count: 234, resetAt: 'Mon Jul 21 2025' },
        '2': { count: 567, resetAt: 'Mon Jul 21 2025' },
        '3': { count: 89, resetAt: 'Mon Jul 21 2025' },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Invalid or missing admin key' })
  getAllStats() {
    return this.adminService.getAllStats();
  }

  @Get('usage-logs')
  @ApiOperation({
    summary: 'Get all usage logs',
    description: 'Returns recent API usage logs across all customers',
  })
  @ApiResponse({
    status: 200,
    description: 'Usage logs array',
    schema: {
      example: [
        {
          id: 1,
          customerId: 1,
          endpoint: '/api/users',
          method: 'GET',
          statusCode: 200,
          timestamp: '2024-01-20T15:30:00.000Z',
        },
      ],
    },
  })
  @ApiResponse({ status: 401, description: 'Invalid or missing admin key' })
  getUsageLogs() {
    return this.adminService.getUsageLogs();
  }

  @Get('usage/:customerId')
  @ApiOperation({
    summary: 'Get customer rate limit status',
    description: 'Returns current rate limit usage and reset time for a specific customer',
  })
  @ApiParam({
    name: 'customerId',
    type: 'string',
    description: 'Customer ID to check rate limit for',
  })
  @ApiResponse({
    status: 200,
    description: 'Customer rate limit data',
    schema: {
      example: {
        count: '234',
        resetAt: 'Mon Jul 21 2025 00:00:00 GMT+0000 (Coordinated Universal Time)',
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Invalid or missing admin key' })
  @ApiResponse({ status: 404, description: 'Customer not found' })
  getUserUsage(@Param('customerId') customerId: string) {
    return this.adminService.getCustomerRateLimit(customerId);
  }

  @Get('usage-logs/:customerId')
  @ApiOperation({
    summary: 'Get customer API history',
    description: 'Returns detailed API call history for a specific customer',
  })
  @ApiParam({
    name: 'customerId',
    type: 'string',
    description: 'Customer ID to get history for',
  })
  @ApiResponse({
    status: 200,
    description: 'Customer API history',
    schema: {
      example: [
        {
          id: 1,
          endpoint: '/api/users',
          method: 'GET',
          statusCode: 200,
          responseTime: 45,
          timestamp: '2024-01-20T15:30:00.000Z',
        },
      ],
    },
  })
  @ApiResponse({ status: 401, description: 'Invalid or missing admin key' })
  @ApiResponse({ status: 404, description: 'Customer not found' })
  getCustomerApiHistory(@Param('customerId') customerId: string) {
    return this.adminService.getCustomerApiHistory(customerId);
  }

  @Get('customer/:apiKey')
  @ApiOperation({
    summary: 'Find customer by API key',
    description: 'Returns customer information associated with the given API key',
  })
  @ApiParam({
    name: 'apiKey',
    type: 'string',
    description: 'API key to lookup',
  })
  @ApiResponse({
    status: 200,
    description: 'Customer information',
    schema: {
      example: {
        customer: {
          id: 1,
          email: 'customer@example.com',
          name: 'Acme Corp',
          tier: {
            id: 2,
            name: 'PRO',
            price: 99,
            rateLimit: 10000,
          },
        },
        developer: {
          id: 1,
          name: 'HTTPBin',
          apiUrl: 'https://httpbin.org',
        },
        apiKey: {
          id: 1,
          isActive: true,
          expiresAt: null,
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Invalid or missing admin key' })
  @ApiResponse({ status: 404, description: 'API key not found' })
  findCustomerByApiKey(@Param('apiKey') apiKey: string) {
    return this.customerService.findByApiKey(apiKey);
  }

  // Billing Admin Endpoints
  @Post('billing/generate-monthly-invoices')
  @ApiOperation({
    summary: 'Generate monthly invoices',
    description: 'Generates invoices for all customers or specific customers for their current billing period',
  })
  @ApiBody({
    type: GenerateInvoicesDto,
    examples: {
      allCustomers: {
        summary: 'Generate for all customers',
        value: {},
      },
      specificCustomers: {
        summary: 'Generate for specific customers',
        value: {
          customerIds: [1, 2, 3],
          billingDate: '2024-01-31',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Invoice generation results',
    schema: {
      example: {
        successful: 3,
        failed: 0,
        errors: [],
        invoices: [
          {
            id: 1,
            invoiceNumber: 'INV-2024-0001',
            customerId: 1,
            amount: 99.0,
            status: 'PENDING',
          },
        ],
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Invalid or missing admin key' })
  generateMonthlyInvoices(@Body(ValidationPipe) generateDto: GenerateInvoicesDto) {
    return this.billingService.generateMonthlyInvoices(generateDto);
  }

  @Post('billing/mark-overdue-invoices')
  @ApiOperation({
    summary: 'Mark overdue invoices',
    description: 'Updates status of all invoices past due date to OVERDUE',
  })
  @ApiResponse({
    status: 200,
    description: 'Number of invoices marked as overdue',
    schema: {
      example: {
        updated: 5,
        message: 'Successfully marked 5 invoices as overdue',
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Invalid or missing admin key' })
  markOverdueInvoices() {
    return this.billingService.markOverdueInvoices();
  }

  @Get('billing/invoices')
  @ApiOperation({
    summary: 'Query all invoices',
    description: 'Search and filter invoices across all customers with pagination',
  })
  @ApiQuery({ name: 'customerId', required: false, type: 'number', description: 'Filter by customer ID' })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['PENDING', 'PAID', 'OVERDUE', 'CANCELLED'],
    description: 'Filter by invoice status',
  })
  @ApiQuery({
    name: 'startDate',
    required: false,
    type: 'string',
    description: 'Filter invoices created after this date',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    type: 'string',
    description: 'Filter invoices created before this date',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: 'number',
    description: 'Number of results to return (default: 20)',
  })
  @ApiQuery({ name: 'offset', required: false, type: 'number', description: 'Number of results to skip (default: 0)' })
  @ApiResponse({
    status: 200,
    description: 'Paginated invoice list',
    schema: {
      example: {
        invoices: [
          {
            id: 1,
            invoiceNumber: 'INV-2024-0001',
            customerId: 1,
            customerName: 'Acme Corp',
            amount: 99.0,
            status: 'PAID',
            dueDate: '2024-02-15',
            paidAt: '2024-02-10',
          },
        ],
        total: 150,
        limit: 20,
        offset: 0,
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Invalid or missing admin key' })
  getAllInvoices(@Query() query: InvoiceQueryDto) {
    return this.billingService.queryInvoices(query);
  }

  @Get('billing/summary')
  @ApiOperation({
    summary: 'Get billing summary',
    description: 'Returns billing summary for all customers or a specific customer',
  })
  @ApiQuery({
    name: 'customerId',
    required: false,
    type: 'string',
    description: 'Get summary for specific customer (omit for system-wide summary)',
  })
  @ApiResponse({
    status: 200,
    description: 'Billing summary data',
    schema: {
      example: {
        totalInvoices: 150,
        totalAmount: 14850.0,
        paidAmount: 12500.0,
        pendingAmount: 1850.0,
        overdueAmount: 500.0,
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Invalid or missing admin key' })
  getSystemWideBillingSummary(@Query('customerId') customerId?: string) {
    const id = customerId ? parseInt(customerId, 10) : undefined;
    if (id !== undefined && !isNaN(id)) {
      return this.billingService.getInvoiceSummary(id);
    } else {
      return this.billingService.getInvoiceSummary();
    }
  }
}
