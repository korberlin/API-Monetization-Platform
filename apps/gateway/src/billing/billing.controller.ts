import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  Req,
  ValidationPipe,
} from '@nestjs/common';
import { Request } from 'express';
import { BillingClientService } from './billing-client.service';
import {
  CreateInvoiceDto,
  GenerateInvoicesDto,
  InvoiceQueryDto,
  UpdateInvoiceStatusDto,
  InvoiceResponseDto,
  InvoiceSummaryDto,
} from './dtos/create-invoice.dto';
import { UsageHistoryQueryDto } from './dtos/usage-history.dto';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiSecurity,
  ApiParam,
  ApiQuery,
  ApiBody,
  ApiBadRequestResponse,
} from '@nestjs/swagger';
import {
  BillingPeriodDto,
  CurrentUsageDto,
  BillingHistoryItemDto,
  PricingTierDto,
  TierUpgradePreviewDto,
  UsageHistoryItemDto,
  PaymentPeriodDto,
} from './dtos/billing-response.dto';

@ApiTags('Billing')
@ApiSecurity('api-key')
@Controller('billing')
export class BillingController {
  constructor(private billingService: BillingClientService) {}

  // Pricing endpoints that use authenticated customer context
  @Get('pricing/current-period')
  @ApiOperation({
    summary: 'Get current payment period details',
    description: 'Returns detailed information about the current billing period including costs and usage',
  })
  @ApiResponse({
    status: 200,
    description: 'Current payment period information',
    type: PaymentPeriodDto,
  })
  getCurrentPaymentPeriod(@Req() request: Request) {
    const customerId = request['customer'].id;
    return this.billingService.getCurrentPaymentPeriod(customerId);
  }

  @Get('pricing/usage-history')
  @ApiOperation({
    summary: 'Get usage history for a specific period',
    description:
      'Returns daily usage statistics for the specified date range or current billing period if no dates provided',
  })
  @ApiQuery({
    name: 'startDate',
    required: false,
    type: String,
    description: 'Start date in ISO format (YYYY-MM-DD)',
    example: '2024-01-01',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    type: String,
    description: 'End date in ISO format (YYYY-MM-DD)',
    example: '2024-01-31',
  })
  @ApiResponse({
    status: 200,
    description: 'Array of daily usage statistics',
    type: [UsageHistoryItemDto],
  })
  @ApiBadRequestResponse({
    description: 'Both startDate and endDate must be provided together',
  })
  async getUsageForPeriod(@Req() request: Request, @Query() query: UsageHistoryQueryDto) {
    const customerId = request['customer'].id;
    if (query.startDate && query.endDate) {
      return this.billingService.getUsageForPeriod(customerId, new Date(query.startDate), new Date(query.endDate));
    } else if (query.startDate || query.endDate) {
      throw new BadRequestException('Both startDate and endDate must be provided');
    } else {
      // Use current billing period as default
      const billingPeriod = await this.billingService.getCurrentBillingPeriod(customerId);
      return this.billingService.getUsageForPeriod(customerId, billingPeriod.startDate, billingPeriod.endDate);
    }
  }

  // billing controllers
  @Get('current-period')
  @ApiOperation({
    summary: 'Get current billing period',
    description: 'Returns information about the current billing cycle including start/end dates and progress',
  })
  @ApiResponse({
    status: 200,
    description: 'Current billing period information',
    type: BillingPeriodDto,
  })
  getCurrentPeriod(@Req() request: Request) {
    const customerId = request['customer'].id;
    return this.billingService.getCurrentBillingPeriod(customerId);
  }

  @Get('current-usage')
  @ApiOperation({
    summary: 'Get current usage statistics',
    description: 'Returns real-time usage information for the current billing period including quota consumption',
  })
  @ApiResponse({
    status: 200,
    description: 'Current usage statistics',
    type: CurrentUsageDto,
  })
  getCurrentUsage(@Req() request: Request) {
    const customerId = request['customer'].id;
    return this.billingService.getCurrentUsage(customerId);
  }

  @Get('history')
  @ApiOperation({
    summary: 'Get billing history',
    description: 'Returns historical billing periods with usage and invoice information',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Maximum number of records to return',
    example: 12,
  })
  @ApiResponse({
    status: 200,
    description: 'List of historical billing periods',
    type: [BillingHistoryItemDto],
  })
  getBillingHistory(@Req() request: Request, @Query('limit', ParseIntPipe) limit?: number) {
    const customerId = request['customer'].id;
    return this.billingService.getBillingHistory(customerId, limit);
  }

  @Get('tiers')
  @ApiOperation({
    summary: 'Get available pricing tiers',
    description: 'Returns all available pricing tiers with features and current tier indication',
  })
  @ApiResponse({
    status: 200,
    description: 'List of available pricing tiers',
    type: [PricingTierDto],
  })
  getAvailableTiers(@Req() request: Request) {
    const customerId = request['customer'].id;
    return this.billingService.getAvailableTiers(customerId);
  }

  @Post('preview-upgrade')
  @ApiOperation({
    summary: 'Preview tier upgrade',
    description: 'Calculate pro-rated costs and details for upgrading to a new pricing tier',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        newTierId: {
          type: 'number',
          example: 2,
          description: 'ID of the tier to upgrade to',
        },
      },
      required: ['newTierId'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Tier upgrade preview with cost calculations',
    type: TierUpgradePreviewDto,
  })
  previewUpgrade(@Req() request: Request, @Body() body: { newTierId: number }) {
    const customerId = request['customer'].id;
    return this.billingService.previewTierUpgrade(customerId, body.newTierId);
  }

  // Invoice endpoints
  @Post('invoices')
  @ApiOperation({
    summary: 'Create a new invoice',
    description: 'Manually create an invoice for a specific period (usually handled automatically)',
  })
  @ApiBody({
    type: CreateInvoiceDto,
    description: 'Invoice details (customerId is automatically set from authentication)',
  })
  @ApiResponse({
    status: 201,
    description: 'Invoice created successfully',
    type: InvoiceResponseDto,
  })
  createInvoice(@Req() request: Request, @Body(ValidationPipe) createInvoiceDto: Omit<CreateInvoiceDto, 'customerId'>) {
    const customerId = request['customer'].id;
    return this.billingService.generateInvoice({ ...createInvoiceDto, customerId });
  }

  @Get('invoices/summary')
  @ApiOperation({
    summary: 'Get invoice summary',
    description: 'Returns aggregated invoice statistics including totals by status',
  })
  @ApiResponse({
    status: 200,
    description: 'Invoice summary statistics',
    type: InvoiceSummaryDto,
  })
  getInvoiceSummary(@Req() request: Request) {
    const customerId = request['customer'].id;
    return this.billingService.getInvoiceSummary(customerId);
  }

  @Get('invoices/:id')
  @ApiOperation({
    summary: 'Get invoice by ID',
    description: 'Retrieve detailed information about a specific invoice including line items',
  })
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'Invoice ID',
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Invoice details',
    type: InvoiceResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Invoice not found',
  })
  getInvoice(@Param('id', ParseIntPipe) id: number) {
    return this.billingService.getInvoice(id);
  }

  @Put('invoices/:id/status')
  @ApiOperation({
    summary: 'Update invoice status',
    description: 'Change the status of an invoice (e.g., from PENDING to PAID)',
  })
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'Invoice ID',
    example: 1,
  })
  @ApiBody({
    type: UpdateInvoiceStatusDto,
  })
  @ApiResponse({
    status: 200,
    description: 'Invoice status updated successfully',
    type: InvoiceResponseDto,
  })
  updateInvoiceStatus(@Param('id', ParseIntPipe) id: number, @Body(ValidationPipe) updateDto: UpdateInvoiceStatusDto) {
    return this.billingService.updateInvoiceStatus(id, updateDto);
  }

  @Put('invoices/:id/mark-paid')
  @ApiOperation({
    summary: 'Mark invoice as paid',
    description: 'Convenience endpoint to quickly mark an invoice as paid with current timestamp',
  })
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'Invoice ID',
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Invoice marked as paid',
    type: InvoiceResponseDto,
  })
  markInvoiceAsPaid(@Param('id', ParseIntPipe) id: number) {
    return this.billingService.markInvoiceAsPaid(id);
  }

  @Get('invoices')
  @ApiOperation({
    summary: 'Query invoices',
    description: 'Search and filter invoices with various criteria',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['DRAFT', 'PENDING', 'PAID', 'OVERDUE', 'CANCELLED'],
    description: 'Filter by invoice status',
  })
  @ApiQuery({
    name: 'startDate',
    required: false,
    type: String,
    description: 'Filter invoices created after this date',
    example: '2024-01-01',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    type: String,
    description: 'Filter invoices created before this date',
    example: '2024-12-31',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Maximum number of results',
    example: 20,
  })
  @ApiQuery({
    name: 'offset',
    required: false,
    type: Number,
    description: 'Number of results to skip',
    example: 0,
  })
  @ApiResponse({
    status: 200,
    description: 'List of invoices matching the query',
    type: [InvoiceResponseDto],
  })
  queryInvoices(@Req() request: Request, @Query(ValidationPipe) query: Omit<InvoiceQueryDto, 'customerId'>) {
    const customerId = request['customer'].id;
    return this.billingService.queryInvoices({ ...query, customerId });
  }
}
