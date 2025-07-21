import { Test, TestingModule } from '@nestjs/testing';
import { InvoiceService } from './invoice.service';
import { PrismaService } from '../prisma/prisma.service';
import { BillingService } from '../billing/billing.service';
import { PricingService } from '../pricing/pricing.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { InvoiceStatus } from '@prisma/client';

describe('InvoiceService', () => {
  let invoiceService: InvoiceService;
  let prismaService: any;
  let billingService: any;
  let pricingService: any;

  const mockCustomer = {
    id: 1,
    name: 'Test Customer',
    email: 'test@example.com',
    tier: {
      id: 1,
      name: 'Pro',
      price: { toNumber: () => 99.99 },
    },
  };

  const mockInvoice = {
    id: 1,
    invoiceNumber: 'INV-2024-01-001',
    customerId: 1,
    customer: mockCustomer,
    periodStart: new Date('2024-01-01'),
    periodEnd: new Date('2024-02-01'),
    totalUsage: 5000,
    amount: { toNumber: () => 99.99 },
    status: InvoiceStatus.PENDING,
    dueDate: new Date('2024-02-08'),
    paidAt: null,
    stripeInvoiceId: null,
    createdAt: new Date('2024-02-01'),
    lineItems: [],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvoiceService,
        {
          provide: PrismaService,
          useValue: {
            customer: {
              findUnique: jest.fn(),
              findMany: jest.fn(),
            },
            invoice: {
              findFirst: jest.fn(),
              findUnique: jest.fn(),
              findMany: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
              updateMany: jest.fn(),
              aggregate: jest.fn(),
            },
            invoiceLineItem: {
              createMany: jest.fn(),
            },
          },
        },
        {
          provide: BillingService,
          useValue: {
            getCurrentBillingPeriod: jest.fn(),
          },
        },
        {
          provide: PricingService,
          useValue: {
            calculateUsageForPeriod: jest.fn(),
          },
        },
      ],
    }).compile();

    invoiceService = module.get<InvoiceService>(InvoiceService);
    prismaService = module.get(PrismaService);
    billingService = module.get(BillingService);
    pricingService = module.get(PricingService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('generateInvoice', () => {
    const createInvoiceDto = {
      customerId: 1,
      periodStart: new Date('2024-01-01'),
      periodEnd: new Date('2024-02-01'),
    };

    it('should generate a new invoice successfully', async () => {
      jest.spyOn(invoiceService, 'checkForDuplicateInvoice').mockResolvedValue(false);
      jest.spyOn(invoiceService, 'generateInvoiceNumber').mockResolvedValue('INV-2024-01-001');
      jest.spyOn(invoiceService, 'createInvoiceLineItems').mockResolvedValue();
      jest.spyOn(invoiceService, 'getInvoiceById').mockResolvedValue({
        ...mockInvoice,
        lineItems: [
          {
            id: 1,
            description: 'Pro Plan - January 2024',
            quantity: 1,
            unitPrice: 99.99,
            amount: 99.99,
            createdAt: new Date(),
          },
        ],
      } as any);

      prismaService.customer.findUnique.mockResolvedValue(mockCustomer);
      pricingService.calculateUsageForPeriod.mockResolvedValue({ usage: 5000 });
      prismaService.invoice.create.mockResolvedValue(mockInvoice);

      const result = await invoiceService.generateInvoice(createInvoiceDto);

      expect(result.invoiceNumber).toBe('INV-2024-01-001');
      expect(prismaService.invoice.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          invoiceNumber: 'INV-2024-01-001',
          customerId: 1,
          amount: mockCustomer.tier.price,
          status: InvoiceStatus.PENDING,
        }),
      });
    });

    it('should throw error for duplicate invoice', async () => {
      jest.spyOn(invoiceService, 'checkForDuplicateInvoice').mockResolvedValue(true);

      await expect(invoiceService.generateInvoice(createInvoiceDto)).rejects.toThrow(BadRequestException);
    });

    it('should throw error for non-existent customer', async () => {
      jest.spyOn(invoiceService, 'checkForDuplicateInvoice').mockResolvedValue(false);
      prismaService.customer.findUnique.mockResolvedValue(null);

      await expect(invoiceService.generateInvoice(createInvoiceDto)).rejects.toThrow(NotFoundException);
    });
  });

  describe('generateInvoiceNumber', () => {
    it('should generate first invoice number of the month', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2024-01-15'));

      prismaService.invoice.findFirst.mockResolvedValue(null);

      const result = await invoiceService.generateInvoiceNumber();

      expect(result).toBe('INV-2024-01-001');
      jest.useRealTimers();
    });

    it('should increment existing invoice number', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2024-01-15'));

      prismaService.invoice.findFirst.mockResolvedValue({
        invoiceNumber: 'INV-2024-01-005',
      });

      const result = await invoiceService.generateInvoiceNumber();

      expect(result).toBe('INV-2024-01-006');
      jest.useRealTimers();
    });
  });

  describe('createInvoiceLineItems', () => {
    it('should create line items for invoice', async () => {
      prismaService.customer.findUnique.mockResolvedValue(mockCustomer);
      pricingService.calculateUsageForPeriod.mockResolvedValue({ usage: 5000 });

      await invoiceService.createInvoiceLineItems(1, 1, new Date('2024-01-01'), new Date('2024-02-01'));

      expect(prismaService.invoiceLineItem.createMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({
            invoiceId: 1,
            description: 'Pro Plan - January 2024',
            quantity: 1,
            unitPrice: 99.99,
            amount: 99.99,
          }),
          expect.objectContaining({
            invoiceId: 1,
            description: 'API Calls: 5,000 requests',
            quantity: 5000,
            unitPrice: 0,
            amount: 0,
          }),
        ],
      });
    });
  });

  describe('updateInvoiceStatus', () => {
    it('should update invoice status', async () => {
      prismaService.invoice.findUnique.mockResolvedValue(mockInvoice);
      prismaService.invoice.update.mockResolvedValue(mockInvoice);
      jest.spyOn(invoiceService, 'getInvoiceById').mockResolvedValue(mockInvoice as any);

      const result = await invoiceService.updateInvoiceStatus(1, {
        status: InvoiceStatus.PAID,
        paidAt: new Date('2024-02-05'),
      });

      expect(prismaService.invoice.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          status: InvoiceStatus.PAID,
          paidAt: new Date('2024-02-05'),
          stripeInvoiceId: undefined,
        },
      });
    });

    it('should throw error for non-existent invoice', async () => {
      prismaService.invoice.findUnique.mockResolvedValue(null);

      await expect(
        invoiceService.updateInvoiceStatus(999, {
          status: InvoiceStatus.PAID,
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('queryInvoices', () => {
    it('should query invoices with filters', async () => {
      const mockInvoices = [mockInvoice];
      prismaService.invoice.findMany.mockResolvedValue(mockInvoices);

      const result = await invoiceService.queryInvoices({
        customerId: 1,
        status: InvoiceStatus.PENDING,
        limit: 10,
        offset: 0,
      });

      expect(prismaService.invoice.findMany).toHaveBeenCalledWith({
        where: {
          customerId: 1,
          status: InvoiceStatus.PENDING,
        },
        take: 10,
        skip: 0,
        orderBy: { createdAt: 'desc' },
        include: {
          lineItems: true,
          customer: true,
        },
      });
      expect(result).toHaveLength(1);
    });
  });

  describe('getInvoiceSummary', () => {
    it('should return invoice summary', async () => {
      prismaService.invoice.aggregate
        .mockResolvedValueOnce({
          _count: 10,
          _sum: { amount: { toNumber: () => 999.9 } },
        })
        .mockResolvedValueOnce({
          _sum: { amount: { toNumber: () => 699.93 } },
        })
        .mockResolvedValueOnce({
          _sum: { amount: { toNumber: () => 299.97 } },
        })
        .mockResolvedValueOnce({
          _sum: { amount: { toNumber: () => 99.99 } },
        });

      const result = await invoiceService.getInvoiceSummary();

      expect(result).toEqual({
        totalInvoices: 10,
        totalAmount: 999.9,
        paidAmount: 699.93,
        pendingAmount: 299.97,
        overdueAmount: 99.99,
      });
    });
  });

  describe('generateMonthlyInvoices', () => {
    it('should generate monthly invoices for eligible customers', async () => {
      const mockCustomers = [
        { id: 1, isActive: true },
        { id: 2, isActive: true },
      ];

      prismaService.customer.findMany.mockResolvedValue(mockCustomers);
      billingService.getCurrentBillingPeriod.mockResolvedValue({
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-02-01'),
        daysRemaining: 3,
      });

      jest
        .spyOn(invoiceService, 'generateInvoice')
        .mockResolvedValueOnce({ id: 1 } as any)
        .mockRejectedValueOnce(new Error('Customer 2 error'));

      const result = await invoiceService.generateMonthlyInvoices({});

      expect(result.successful).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toEqual({
        customerId: 2,
        error: 'Customer 2 error',
      });
    });
  });

  describe('markOverdueInvoices', () => {
    it('should mark overdue invoices', async () => {
      prismaService.invoice.updateMany.mockResolvedValue({ count: 5 });

      const result = await invoiceService.markOverdueInvoices();

      expect(result).toBe(5);
      expect(prismaService.invoice.updateMany).toHaveBeenCalledWith({
        where: {
          status: InvoiceStatus.PENDING,
          dueDate: {
            lt: expect.any(Date),
          },
        },
        data: {
          status: InvoiceStatus.OVERDUE,
        },
      });
    });
  });

  describe('checkForDuplicateInvoice', () => {
    it('should return true when duplicate exists', async () => {
      prismaService.invoice.findFirst.mockResolvedValue(mockInvoice);

      const result = await invoiceService.checkForDuplicateInvoice(1, new Date('2024-01-01'), new Date('2024-02-01'));

      expect(result).toBe(true);
    });

    it('should return false when no duplicate', async () => {
      prismaService.invoice.findFirst.mockResolvedValue(null);

      const result = await invoiceService.checkForDuplicateInvoice(1, new Date('2024-01-01'), new Date('2024-02-01'));

      expect(result).toBe(false);
    });
  });
});
