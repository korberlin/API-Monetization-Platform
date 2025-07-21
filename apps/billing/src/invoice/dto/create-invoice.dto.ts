import { IsNumber, IsDate, IsOptional, IsEnum, IsString, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { InvoiceStatus } from '@prisma/client';

export class CreateInvoiceDto {
  @IsNumber()
  customerId: number;

  @IsDate()
  @Type(() => Date)
  periodStart: Date;

  @IsDate()
  @Type(() => Date)
  periodEnd: Date;

  @IsOptional()
  @IsNumber()
  totalUsage?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateLineItemDto {
  @IsString()
  description: string;

  @IsNumber()
  quantity: number;

  @IsNumber()
  unitPrice: number;

  @IsNumber()
  amount: number;
}

export class UpdateInvoiceStatusDto {
  @IsEnum(InvoiceStatus)
  status: InvoiceStatus;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  paidAt?: Date | null;

  @IsOptional()
  @IsString()
  stripeInvoiceId?: string | null;
}

export class InvoiceLineItemResponseDto {
  id: number;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  createdAt: Date;
}

export class InvoiceResponseDto {
  id: number;
  invoiceNumber: string;
  customerId: number;
  customerName?: string;
  customerEmail?: string;
  periodStart: Date;
  periodEnd: Date;
  totalUsage: number;
  amount: number;
  status: InvoiceStatus;
  dueDate: Date;
  paidAt?: Date | null; // Changed to allow null
  stripeInvoiceId?: string | null; // Changed to allow null
  createdAt: Date;
  lineItems: InvoiceLineItemResponseDto[];
}

export class GenerateInvoicesDto {
  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  customerIds?: number[]; // Optional: generate for specific customers

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  billingDate?: Date; // Optional: override billing date (default: today)
}

export class InvoiceQueryDto {
  @IsOptional()
  @IsNumber()
  customerId?: number;

  @IsOptional()
  @IsEnum(InvoiceStatus)
  status?: InvoiceStatus;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  startDate?: Date;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  endDate?: Date;

  @IsOptional()
  @IsNumber()
  limit?: number;

  @IsOptional()
  @IsNumber()
  offset?: number;
}

export class InvoiceSummaryDto {
  totalInvoices: number;
  totalAmount: number;
  paidAmount: number;
  pendingAmount: number;
  overdueAmount: number;
}

export class BulkInvoiceResultDto {
  successful: number;
  failed: number;
  errors: Array<{
    customerId: number;
    error: string;
  }>;
  invoices: InvoiceResponseDto[];
}
