import { IsNumber, IsDate, IsOptional, IsEnum, IsString, IsArray } from 'class-validator';
import { Type } from 'class-transformer';
import { InvoiceStatus } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateInvoiceDto {
  @ApiProperty({ example: 1, description: 'Customer ID (automatically set from authentication)' })
  @IsNumber()
  customerId: number;

  @ApiProperty({ example: '2024-01-01T00:00:00.000Z', description: 'Start date of the billing period' })
  @IsDate()
  @Type(() => Date)
  periodStart: Date;

  @ApiProperty({ example: '2024-01-31T23:59:59.999Z', description: 'End date of the billing period' })
  @IsDate()
  @Type(() => Date)
  periodEnd: Date;

  @ApiPropertyOptional({ example: 45231, description: 'Total API usage for the period' })
  @IsOptional()
  @IsNumber()
  totalUsage?: number;

  @ApiPropertyOptional({ example: 'Manual invoice for custom period', description: 'Additional notes for the invoice' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateLineItemDto {
  @ApiProperty({ example: 'API Usage - January 2024', description: 'Description of the line item' })
  @IsString()
  description: string;

  @ApiProperty({ example: 45231, description: 'Quantity (e.g., number of API calls)' })
  @IsNumber()
  quantity: number;

  @ApiProperty({ example: 0.003, description: 'Price per unit' })
  @IsNumber()
  unitPrice: number;

  @ApiProperty({ example: 135.69, description: 'Total amount for this line item' })
  @IsNumber()
  amount: number;
}

export class UpdateInvoiceStatusDto {
  @ApiProperty({
    enum: InvoiceStatus,
    example: 'PAID',
    description: 'New status for the invoice',
  })
  @IsEnum(InvoiceStatus)
  status: InvoiceStatus;

  @ApiPropertyOptional({
    example: '2024-02-01T10:30:00.000Z',
    description: 'Date when the invoice was paid',
  })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  paidAt?: Date | null;

  @ApiPropertyOptional({
    example: 'in_1234567890abcdef',
    description: 'Stripe invoice ID for payment tracking',
  })
  @IsOptional()
  @IsString()
  stripeInvoiceId?: string | null;
}

export class InvoiceLineItemResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'API Usage - Overage' })
  description: string;

  @ApiProperty({ example: 35231 })
  quantity: number;

  @ApiProperty({ example: 0.003 })
  unitPrice: number;

  @ApiProperty({ example: 105.69 })
  amount: number;

  @ApiProperty({ example: '2024-02-01T00:00:00.000Z' })
  createdAt: Date;
}

export class InvoiceResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'INV-2024-0001' })
  invoiceNumber: string;

  @ApiProperty({ example: 1 })
  customerId: number;

  @ApiPropertyOptional({ example: 'Acme Corporation' })
  customerName?: string;

  @ApiPropertyOptional({ example: 'billing@acme.com' })
  customerEmail?: string;

  @ApiProperty({ example: '2024-01-01T00:00:00.000Z' })
  periodStart: Date;

  @ApiProperty({ example: '2024-01-31T23:59:59.999Z' })
  periodEnd: Date;

  @ApiProperty({ example: 45231 })
  totalUsage: number;

  @ApiProperty({ example: 135.69 })
  amount: number;

  @ApiProperty({ enum: InvoiceStatus, example: 'PENDING' })
  status: InvoiceStatus;

  @ApiProperty({ example: '2024-03-01T00:00:00.000Z' })
  dueDate: Date;

  @ApiPropertyOptional({ example: '2024-02-15T14:30:00.000Z' })
  paidAt?: Date | null;

  @ApiPropertyOptional({ example: 'in_1234567890abcdef' })
  stripeInvoiceId?: string | null;

  @ApiProperty({ example: '2024-02-01T00:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ type: [InvoiceLineItemResponseDto] })
  lineItems: InvoiceLineItemResponseDto[];
}

export class GenerateInvoicesDto {
  @ApiPropertyOptional({
    type: [Number],
    example: [1, 2, 3],
    description: 'Specific customer IDs to generate invoices for',
  })
  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  customerIds?: number[];

  @ApiPropertyOptional({
    example: '2024-02-01',
    description: 'Override billing date (defaults to today)',
  })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  billingDate?: Date | string;
}

export class InvoiceQueryDto {
  @ApiPropertyOptional({ example: 1, description: 'Filter by customer ID' })
  @IsOptional()
  @IsNumber()
  customerId?: number;

  @ApiPropertyOptional({
    enum: InvoiceStatus,
    example: 'PENDING',
    description: 'Filter by invoice status',
  })
  @IsOptional()
  @IsEnum(InvoiceStatus)
  status?: InvoiceStatus;

  @ApiPropertyOptional({
    example: '2024-01-01',
    description: 'Filter invoices created after this date',
  })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  startDate?: Date;

  @ApiPropertyOptional({
    example: '2024-12-31',
    description: 'Filter invoices created before this date',
  })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  endDate?: Date;

  @ApiPropertyOptional({ example: 20, description: 'Maximum number of results' })
  @IsOptional()
  @IsNumber()
  limit?: number;

  @ApiPropertyOptional({ example: 0, description: 'Number of results to skip' })
  @IsOptional()
  @IsNumber()
  offset?: number;
}

export class InvoiceSummaryDto {
  @ApiProperty({ example: 12, description: 'Total number of invoices' })
  totalInvoices: number;

  @ApiProperty({ example: 1542.5, description: 'Total amount across all invoices' })
  totalAmount: number;

  @ApiProperty({ example: 1135.0, description: 'Total amount paid' })
  paidAmount: number;

  @ApiProperty({ example: 407.5, description: 'Total amount pending' })
  pendingAmount: number;

  @ApiProperty({ example: 135.5, description: 'Total amount overdue' })
  overdueAmount: number;
}

export class BulkInvoiceResultDto {
  @ApiProperty({ example: 5, description: 'Number of successfully created invoices' })
  successful: number;

  @ApiProperty({ example: 1, description: 'Number of failed invoice creations' })
  failed: number;

  @ApiProperty({
    type: 'array',
    items: {
      type: 'object',
      properties: {
        customerId: { type: 'number' },
        error: { type: 'string' },
      },
    },
    example: [{ customerId: 999, error: 'Customer not found' }],
  })
  errors: Array<{
    customerId: number;
    error: string;
  }>;

  @ApiProperty({ type: [InvoiceResponseDto] })
  invoices: InvoiceResponseDto[];
}
