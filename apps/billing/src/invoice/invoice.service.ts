// src/invoice/invoice.service.ts

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { BillingService } from 'src/billing/billing.service';
import { PricingService } from 'src/pricing/pricing.service';
import { InvoiceStatus } from '@prisma/client';
import {
  CreateInvoiceDto,
  UpdateInvoiceStatusDto,
  InvoiceResponseDto,
  GenerateInvoicesDto,
  InvoiceQueryDto,
  InvoiceSummaryDto,
  BulkInvoiceResultDto,
  CreateLineItemDto,
} from './dto/create-invoice.dto';

@Injectable()
export class InvoiceService {
  constructor(
    private prismaService: PrismaService,
    private billingService: BillingService,
    private pricingService: PricingService,
  ) {}

  async generateInvoice(createInvoiceDto: CreateInvoiceDto): Promise<InvoiceResponseDto> {
    const { customerId, periodStart, periodEnd } = createInvoiceDto;

    // Check for duplicate invoice
    console.time(`Generated invoice for ${createInvoiceDto.customerId}`);
    const existingInvoice = await this.checkForDuplicateInvoice(customerId, periodStart, periodEnd);
    if (existingInvoice) {
      throw new BadRequestException(
        `Invoice already exists for customer ${customerId} for period ${periodStart.toISOString()} to ${periodEnd.toISOString()}`
      );
    }

    // Get customer with tier
    const customer = await this.prismaService.customer.findUnique({
      where: { id: customerId },
      include: { tier: true },
    });

    if (!customer) {
      throw new NotFoundException(`Customer with ID ${customerId} not found`);
    }

    // Calculate usage for the period
    const usage = await this.pricingService.calculateUsageForPeriod(
      customerId,
      periodStart,
      periodEnd
    );

    // Generate invoice number
    const invoiceNumber = await this.generateInvoiceNumber();

    // Calculate due date (7 days from now)
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 7);

    // Create invoice
    const invoice = await this.prismaService.invoice.create({
      data: {
        invoiceNumber,
        customerId,
        periodStart,
        periodEnd,
        totalUsage: usage.usage,
        amount: customer.tier.price,
        status: InvoiceStatus.PENDING,
        dueDate,
      },
    });

    // Create line items
    await this.createInvoiceLineItems(invoice.id, customerId, periodStart, periodEnd);

    // Fetch and return complete invoice
    console.timeEnd(`Generated invoice for ${createInvoiceDto.customerId}`);
    return this.getInvoiceById(invoice.id);
  }

  async createInvoiceLineItems(
    invoiceId: number,
    customerId: number,
    periodStart: Date,
    periodEnd: Date
  ): Promise<void> {
    const customer = await this.prismaService.customer.findUnique({
      where: { id: customerId },
      include: { tier: true },
    });

    if (!customer) {
      throw new NotFoundException(`Customer with ID ${customerId} not found`);
    }

    const usage = await this.pricingService.calculateUsageForPeriod(
      customerId,
      periodStart,
      periodEnd
    );

    const lineItems: CreateLineItemDto[] = [];

    // Base plan charge
    const monthYear = periodStart.toLocaleString('default', { month: 'long', year: 'numeric' });
    lineItems.push({
      description: `${customer.tier.name} Plan - ${monthYear}`,
      quantity: 1,
      unitPrice: customer.tier.price.toNumber(),
      amount: customer.tier.price.toNumber(),
    });

    // Usage summary line item (informational, $0)
    lineItems.push({
      description: `API Calls: ${usage.usage.toLocaleString()} requests`,
      quantity: usage.usage,
      unitPrice: 0,
      amount: 0,
    });

    // Create line items in database
    await this.prismaService.invoiceLineItem.createMany({
      data: lineItems.map(item => ({
        invoiceId,
        ...item,
      })),
    });
  }

  async generateInvoiceNumber(): Promise<string> {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');

    // Find the latest invoice number for this month
    const latestInvoice = await this.prismaService.invoice.findFirst({
      where: {
        invoiceNumber: {
          startsWith: `INV-${year}-${month}-`,
        },
      },
      orderBy: {
        invoiceNumber: 'desc',
      },
    });

    let sequence = 1;
    if (latestInvoice) {
      const parts = latestInvoice.invoiceNumber.split('-');
      sequence = parseInt(parts[3]) + 1;
    }

    return `INV-${year}-${month}-${String(sequence).padStart(3, '0')}`;
  }

  async getInvoiceById(invoiceId: number): Promise<InvoiceResponseDto> {
    const invoice = await this.prismaService.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        lineItems: true,
        customer: true,
      },
    });

    if (!invoice) {
      throw new NotFoundException(`Invoice with ID ${invoiceId} not found`);
    }

    return {
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      customerId: invoice.customerId,
      customerName: invoice.customer.name,
      customerEmail: invoice.customer.email,
      periodStart: invoice.periodStart,
      periodEnd: invoice.periodEnd,
      totalUsage: invoice.totalUsage,
      amount: invoice.amount.toNumber(),
      status: invoice.status,
      dueDate: invoice.dueDate,
      paidAt: invoice.paidAt,
      stripeInvoiceId: invoice.stripeInvoiceId,
      createdAt: invoice.createdAt,
      lineItems: invoice.lineItems.map(item => ({
        id: item.id,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice.toNumber(),
        amount: item.amount.toNumber(),
        createdAt: item.createdAt,
      })),
    };
  }

  async updateInvoiceStatus(
    invoiceId: number,
    updateDto: UpdateInvoiceStatusDto
  ): Promise<InvoiceResponseDto> {
    const invoice = await this.prismaService.invoice.findUnique({
      where: { id: invoiceId },
    });

    if (!invoice) {
      throw new NotFoundException(`Invoice with ID ${invoiceId} not found`);
    }

    await this.prismaService.invoice.update({
      where: { id: invoiceId },
      data: {
        status: updateDto.status,
        paidAt: updateDto.paidAt,
        stripeInvoiceId: updateDto.stripeInvoiceId,
      },
    });

    return this.getInvoiceById(invoiceId);
  }

  async markInvoiceAsPaid(invoiceId: number, paidAt?: Date): Promise<InvoiceResponseDto> {
    return this.updateInvoiceStatus(invoiceId, {
      status: InvoiceStatus.PAID,
      paidAt: paidAt || new Date(),
    });
  }

  async checkForDuplicateInvoice(
    customerId: number,
    periodStart: Date,
    periodEnd: Date
  ): Promise<boolean> {
    const existingInvoice = await this.prismaService.invoice.findFirst({
      where: {
        customerId,
        periodStart: {
          equals: periodStart,
        },
        periodEnd: {
          equals: periodEnd,
        },
      },
    });

    return !!existingInvoice;
  }

  async queryInvoices(query: InvoiceQueryDto): Promise<InvoiceResponseDto[]> {
    const { customerId, status, startDate, endDate, limit = 10, offset = 0 } = query;

    const where: any = {};

    if (customerId) where.customerId = customerId;
    if (status) where.status = status;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    const invoices = await this.prismaService.invoice.findMany({
      where,
      take: limit,
      skip: offset,
      orderBy: { createdAt: 'desc' },
      include: {
        lineItems: true,
        customer: true,
      },
    });

    return invoices.map(invoice => ({
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      customerId: invoice.customerId,
      customerName: invoice.customer.name,
      customerEmail: invoice.customer.email,
      periodStart: invoice.periodStart,
      periodEnd: invoice.periodEnd,
      totalUsage: invoice.totalUsage,
      amount: invoice.amount.toNumber(),
      status: invoice.status,
      dueDate: invoice.dueDate,
      paidAt: invoice.paidAt,
      stripeInvoiceId: invoice.stripeInvoiceId,
      createdAt: invoice.createdAt,
      lineItems: invoice.lineItems.map(item => ({
        id: item.id,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice.toNumber(),
        amount: item.amount.toNumber(),
        createdAt: item.createdAt,
      })),
    }));
  }

  async getInvoiceSummary(customerId?: number): Promise<InvoiceSummaryDto> {
    const where = customerId ? { customerId } : {};

    const [total, paid, pending, overdue] = await Promise.all([
      // Total invoices
      this.prismaService.invoice.aggregate({
        where,
        _count: true,
        _sum: { amount: true },
      }),
      // Paid invoices
      this.prismaService.invoice.aggregate({
        where: { ...where, status: InvoiceStatus.PAID },
        _sum: { amount: true },
      }),
      // Pending invoices
      this.prismaService.invoice.aggregate({
        where: { ...where, status: InvoiceStatus.PENDING },
        _sum: { amount: true },
      }),
      // Overdue invoices
      this.prismaService.invoice.aggregate({
        where: { 
          ...where, 
          status: InvoiceStatus.PENDING,
          dueDate: { lt: new Date() }
        },
        _sum: { amount: true },
      }),
    ]);

    return {
      totalInvoices: total._count,
      totalAmount: total._sum.amount?.toNumber() || 0,
      paidAmount: paid._sum.amount?.toNumber() || 0,
      pendingAmount: pending._sum.amount?.toNumber() || 0,
      overdueAmount: overdue._sum.amount?.toNumber() || 0,
    };
  }

  async generateMonthlyInvoices(generateDto: GenerateInvoicesDto): Promise<BulkInvoiceResultDto> {
    const { customerIds, billingDate = new Date() } = generateDto;

    // Get customers to bill
    const customers = await this.prismaService.customer.findMany({
      where: {
        isActive: true,
        ...(customerIds && { id: { in: customerIds } }),
      },
    });

    console.log(customers);
    const results: BulkInvoiceResultDto = {
      successful: 0,
      failed: 0,
      errors: [],
      invoices: [],
    };

    for (const customer of customers) {
      try {
        // Get billing period for this customer
        console.log('custt');
        const billingPeriod = await this.billingService.getCurrentBillingPeriod(customer.id);
        console.log(billingPeriod);

        // Check if we should generate invoice (only if period is ending soon or has ended)
        const daysUntilEnd = billingPeriod.daysRemaining;
        console.log(`Processing ${customer.id} - Days remaining: ${billingPeriod.daysRemaining}`);
        if (daysUntilEnd > 7) {
          continue; // Skip if more than 7 days until period ends
        }

        // Generate invoice
        const invoice = await this.generateInvoice({
          customerId: customer.id,
          periodStart: billingPeriod.startDate,
          periodEnd: billingPeriod.endDate,
        });

        results.successful++;
        results.invoices.push(invoice);
      } catch (error) {
        results.failed++;
        results.errors.push({
          customerId: customer.id,
          error: error.message,
        });
      }
    }

    return results;
  }

  async markOverdueInvoices(): Promise<number> {
    const overdueInvoices = await this.prismaService.invoice.updateMany({
      where: {
        status: InvoiceStatus.PENDING,
        dueDate: {
          lt: new Date(),
        },
      },
      data: {
        status: InvoiceStatus.OVERDUE,
      },
    });

    return overdueInvoices.count;
  }
}