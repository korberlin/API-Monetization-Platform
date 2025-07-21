import { Controller, Get, Post, Put, Body, Param, Query, ParseIntPipe, ValidationPipe } from '@nestjs/common';
import { InvoiceService } from './invoice.service';
import {
  CreateInvoiceDto,
  UpdateInvoiceStatusDto,
  GenerateInvoicesDto,
  InvoiceQueryDto,
} from './dto/create-invoice.dto';

@Controller('invoices')
export class InvoiceController {
  constructor(private readonly invoiceService: InvoiceService) {}

  @Post()
  createInvoice(@Body(ValidationPipe) createInvoiceDto: CreateInvoiceDto) {
    return this.invoiceService.generateInvoice(createInvoiceDto);
  }
  @Get('summary')
  getInvoiceSummary(@Query('customerId', new ParseIntPipe({ optional: true })) customerId?: number) {
    return this.invoiceService.getInvoiceSummary(customerId);
  }

  @Get(':id')
  getInvoice(@Param('id', ParseIntPipe) id: number) {
    return this.invoiceService.getInvoiceById(id);
  }

  @Put(':id/status')
  updateInvoiceStatus(@Param('id', ParseIntPipe) id: number, @Body(ValidationPipe) updateDto: UpdateInvoiceStatusDto) {
    return this.invoiceService.updateInvoiceStatus(id, updateDto);
  }

  @Put(':id/mark-paid')
  markAsPaid(@Param('id', ParseIntPipe) id: number) {
    return this.invoiceService.markInvoiceAsPaid(id);
  }

  @Get()
  queryInvoices(
    @Query(
      new ValidationPipe({
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    )
    query: InvoiceQueryDto,
  ) {
    return this.invoiceService.queryInvoices(query);
  }

  @Post('generate-monthly')
  generateMonthlyInvoices(@Body(ValidationPipe) generateDto: GenerateInvoicesDto) {
    return this.invoiceService.generateMonthlyInvoices(generateDto);
  }

  @Post('mark-overdue')
  async markOverdueInvoices() {
    const count = await this.invoiceService.markOverdueInvoices();
    return { message: `Marked ${count} invoices as overdue` };
  }
}
