import { Injectable, Logger } from '@nestjs/common';
import { InvoiceService } from './invoice.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { BillingService } from 'src/billing/billing.service';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class InvoiceProcessor {
  private readonly logger = new Logger(InvoiceProcessor.name);

  constructor(
    private invoiceService: InvoiceService,
    private prismaService: PrismaService,
    private billingService: BillingService,
  ) {}

  // run daily at 2 AM
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async generateDailyInvoices() {
    this.logger.log('Starting daily invoice generation process...');
    try {
      // fetch all active customers
      const activeCustomers = await this.prismaService.customer.findMany({
        where: {
          isActive: true,
        },
        select: {
          id: true,
          name: true,
          createdAt: true,
        },
      });

      let successCount = 0;
      let skipCount = 0;
      let errorCount = 0;

      for (const customer of activeCustomers) {
        try {
          const billingPeriod = await this.billingService.getCurrentBillingPeriod(customer.id);

          // check if billing period is ending soon (1 day) or already ended
          if (billingPeriod.daysRemaining < 1) {
            skipCount++;
            continue;
          }
          // check invoice already exists
          const existingInvoice = await this.invoiceService.checkForDuplicateInvoice(
            customer.id,
            billingPeriod.startDate,
            billingPeriod.endDate,
          );
          if (existingInvoice) {
            this.logger.debug(`Invoice already exists for customer ${customer.id} for current period`);
            skipCount++;
            continue;
          }
          // generate invoice
          await this.invoiceService.generateInvoice({
            customerId: customer.id,
            periodStart: billingPeriod.startDate,
            periodEnd: billingPeriod.endDate,
          });
          successCount++;
          this.logger.log(`Generated invoice for customer ${customer.id} (${customer.name})`);
        } catch (error) {
          errorCount++;
          this.logger.error(`Failed to generate invoice for customer ${customer.id}: ${error.message}`, error.stack);
        }
      }
      this.logger.log(
        `Invoice generation completed. Success: ${successCount}, Skipped: ${skipCount}, Errors: ${errorCount}`,
      );
    } catch (error) {
      this.logger.error('Failed to run invoice generation process', error.stack);
    }
  }
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async markOverdueInvoices() {
    this.logger.log('Checking for overdue invoices...');
    try {
      const count = await this.invoiceService.markOverdueInvoices();
      this.logger.log(`Marked ${count} invoices as overdue`);
    } catch (error) {
      this.logger.error('Failed to mark overdue invoices', error.stack);
    }
  }

  @Cron('0 0 1 * *')
  async monthlyInvoiceGeneration() {
    this.logger.log('Starting monthly invoice generation...');
    try {
      const result = await this.invoiceService.generateMonthlyInvoices({});
      this.logger.log(`
        Monthly invoice generation completed. Generated ${result.successful} invoices`);
      if (result.errors.length > 0) {
        this.logger.warn('Errors during monghtly generation:', result.errors);
      }
    } catch (error) {
      this.logger.error('Failed to run monthly invoice generation', error.stack);
    }
  }
}
