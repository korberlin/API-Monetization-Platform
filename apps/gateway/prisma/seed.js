const { PrismaClient } = require('@prisma/client');
const { 
  addDays, 
  subDays, 
  startOfMonth, 
  endOfMonth, 
  subMonths,
  format,
  isValid,
  isFuture,
  addMonths
} = require('date-fns');

const prisma = new PrismaClient();

// Validate dates to ensure they're reasonable
function validateDate(date, description) {
  if (!isValid(date)) {
    throw new Error(`Invalid date for ${description}: ${date}`);
  }
  
  const now = new Date();
  const tenYearsFromNow = addMonths(now, 120); // 10 years
  
  if (date > tenYearsFromNow) {
    throw new Error(`Date ${description} is too far in the future: ${date.toISOString()}`);
  }
  
  return date;
}

// Generate safe invoice number based on actual date
function generateInvoiceNumber(date, sequence) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const seq = String(sequence).padStart(3, '0');
  return `INV-${year}-${month}-${seq}`;
}

// Simple helper to generate a reasonable amount of usage data for testing
function generateUsageData(customerId, apiKeyId, startDate, endDate, requestsPerDay) {
  const usage = [];
  const endpoints = [
    '/api/users', '/api/posts', '/api/comments', '/api/products',
    '/api/orders', '/anything', '/get', '/post', '/status/200'
  ];
  const methods = ['GET', 'POST', 'PUT', 'DELETE'];
  
  // Validate input dates
  let currentDate = validateDate(new Date(startDate), 'usage start date');
  const finalDate = validateDate(new Date(endDate), 'usage end date');
  
  // Don't generate future data
  const now = new Date();
  if (finalDate > now) {
    console.log(`⚠️  Capping usage end date to current time for customer ${customerId}`);
    finalDate.setTime(now.getTime());
  }
  
  // Limit to last 7 days for most users
  const sevenDaysAgo = subDays(now, 7);
  if (currentDate < sevenDaysAgo) {
    currentDate = sevenDaysAgo;
  }
  
  while (currentDate <= finalDate) {
    // Generate a few requests per day (not thousands!)
    const dailyRequests = Math.min(requestsPerDay, 50); // Cap at 50/day for testing
    const actualRequests = Math.floor(dailyRequests * (0.7 + Math.random() * 0.3));
    
    for (let i = 0; i < actualRequests; i++) {
      const hour = Math.floor(Math.random() * 24);
      const minute = Math.floor(Math.random() * 60);
      const timestamp = new Date(currentDate);
      timestamp.setHours(hour, minute, 0, 0);
      
      // 85% success rate
      const isSuccess = Math.random() < 0.85;
      let statusCode;
      
      if (isSuccess) {
        statusCode = [200, 201, 204][Math.floor(Math.random() * 3)];
      } else {
        statusCode = [400, 401, 404, 429, 500][Math.floor(Math.random() * 5)];
      }
      
      usage.push({
        customerId: customerId,
        apiKeyId: apiKeyId || null,
        endpoint: endpoints[Math.floor(Math.random() * endpoints.length)],
        method: methods[Math.floor(Math.random() * methods.length)],
        statusCode: statusCode,
        responseTime: Math.floor(50 + Math.random() * 450),
        timestamp: validateDate(timestamp, 'usage timestamp')
      });
    }
    
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  return usage;
}

async function main() {
  console.log('🧹 Clearing existing data...');
  
  // Clear in correct order
  await prisma.invoiceLineItem.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.usageHistory.deleteMany();
  await prisma.apiKey.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.developer.deleteMany();
  await prisma.tier.deleteMany();

  console.log('💰 Creating pricing tiers...');
  
  // Create tiers
  const tiers = await Promise.all([
    prisma.tier.create({
      data: {
        name: 'FREE',
        price: 0,
        rateLimit: 100,
        features: {
          requests: 100,
          support: 'community',
          analytics: 'basic'
        }
      }
    }),
    prisma.tier.create({
      data: {
        name: 'STARTER',
        price: 29,
        rateLimit: 1000,
        features: {
          requests: 1000,
          support: 'email',
          analytics: 'advanced'
        }
      }
    }),
    prisma.tier.create({
      data: {
        name: 'PRO',
        price: 99,
        rateLimit: 10000,
        features: {
          requests: 10000,
          support: 'priority',
          analytics: 'advanced',
          customDomain: true
        }
      }
    }),
    prisma.tier.create({
      data: {
        name: 'ENTERPRISE',
        price: 499,
        rateLimit: 100000,
        features: {
          requests: 100000,
          support: 'dedicated',
          analytics: 'custom',
          sla: '99.99%'
        }
      }
    })
  ]);

  const [freeTier, starterTier, proTier, enterpriseTier] = tiers;

  console.log('🏢 Creating API developers...');
  
  // Create developers
  const httpbin = await prisma.developer.create({
    data: {
      name: 'HTTPBin',
      apiUrl: 'https://httpbin.org'
    }
  });

  const jsonApi = await prisma.developer.create({
    data: {
      name: 'JSONPlaceholder',
      apiUrl: 'https://jsonplaceholder.typicode.com'
    }
  });

  console.log('👥 Creating test customers...');
  
  const now = new Date();
  console.log(`📅 Current date: ${format(now, 'yyyy-MM-dd HH:mm:ss')}`);
  
  const oneMonthAgo = validateDate(subMonths(now, 1), 'one month ago');
  const twoMonthsAgo = validateDate(subMonths(now, 2), 'two months ago');

  // Create a variety of customers
  const customers = [];
  
  // 1. Enterprise customer - high usage
  const enterpriseCustomer = await prisma.customer.create({
    data: {
      name: 'Big Corp Ltd',
      email: 'api@bigcorp.com',
      company: 'Big Corporation',
      developerId: httpbin.id,
      tierId: enterpriseTier.id,
      createdAt: twoMonthsAgo
    }
  });
  customers.push({ customer: enterpriseCustomer, dailyRequests: 40 });
  console.log(`✅ Created enterprise customer with creation date: ${format(twoMonthsAgo, 'yyyy-MM-dd')}`);

  // 2. Pro customer - moderate usage
  const proCustomer = await prisma.customer.create({
    data: {
      name: 'Tech Startup Inc',
      email: 'dev@techstartup.com',
      company: 'Tech Startup',
      developerId: httpbin.id,
      tierId: proTier.id,
      createdAt: oneMonthAgo
    }
  });
  customers.push({ customer: proCustomer, dailyRequests: 25 });

  // 3. Starter customer
  const starterCreatedAt = validateDate(subDays(now, 45), 'starter customer creation');
  const starterCustomer = await prisma.customer.create({
    data: {
      name: 'Small Business',
      email: 'api@smallbiz.com',
      company: 'Small Business Co',
      developerId: jsonApi.id,
      tierId: starterTier.id,
      createdAt: starterCreatedAt
    }
  });
  customers.push({ customer: starterCustomer, dailyRequests: 15 });

  // 4. Free customer - new user
  const freeCreatedAt = validateDate(subDays(now, 7), 'free customer creation');
  const freeCustomer = await prisma.customer.create({
    data: {
      name: 'John Developer',
      email: 'john@example.com',
      developerId: httpbin.id,
      tierId: freeTier.id,
      createdAt: freeCreatedAt
    }
  });
  customers.push({ customer: freeCustomer, dailyRequests: 5 });

  // 5. Inactive customer
  const inactiveCustomer = await prisma.customer.create({
    data: {
      name: 'Old Customer',
      email: 'old@customer.com',
      company: 'Defunct Co',
      developerId: httpbin.id,
      tierId: starterTier.id,
      isActive: false,
      createdAt: twoMonthsAgo
    }
  });
  customers.push({ customer: inactiveCustomer, dailyRequests: 0 });

  console.log('🔑 Creating API keys...');
  
  const apiKeys = [];
  
  // Enterprise customer - multiple keys
  apiKeys.push(await prisma.apiKey.create({
    data: {
      key: 'ent_prod_key_123',
      name: 'Production Key',
      customerId: enterpriseCustomer.id,
      lastUsedAt: now
    }
  }));
  
  apiKeys.push(await prisma.apiKey.create({
    data: {
      key: 'ent_dev_key_456',
      name: 'Development Key',
      customerId: enterpriseCustomer.id,
      isActive: false // Inactive for testing
    }
  }));

  // Pro customer
  apiKeys.push(await prisma.apiKey.create({
    data: {
      key: 'pro_api_key_789',
      name: 'Main API Key',
      customerId: proCustomer.id,
      lastUsedAt: now
    }
  }));

  // Starter customer
  apiKeys.push(await prisma.apiKey.create({
    data: {
      key: 'starter_key_abc',
      name: 'API Key',
      customerId: starterCustomer.id,
      lastUsedAt: validateDate(subDays(now, 1), 'starter key last used')
    }
  }));

  // Free customer
  apiKeys.push(await prisma.apiKey.create({
    data: {
      key: 'free_test_key_xyz',
      name: 'Test Key',
      customerId: freeCustomer.id
    }
  }));

  // Inactive customer - expired key
  const expiredDate = validateDate(subDays(now, 30), 'expired key date');
  apiKeys.push(await prisma.apiKey.create({
    data: {
      key: 'expired_key_999',
      customerId: inactiveCustomer.id,
      expiresAt: expiredDate
    }
  }));

  console.log('📊 Generating usage history (last 7 days)...');
  
  // Generate usage data
  let allUsageData = [];
  const sevenDaysAgo = subDays(now, 7);
  
  // Enterprise customer usage
  allUsageData = allUsageData.concat(
    generateUsageData(enterpriseCustomer.id, apiKeys[0].id, sevenDaysAgo, now, 40)
  );
  
  // Pro customer usage
  allUsageData = allUsageData.concat(
    generateUsageData(proCustomer.id, apiKeys[2].id, sevenDaysAgo, now, 25)
  );
  
  // Starter customer usage
  allUsageData = allUsageData.concat(
    generateUsageData(starterCustomer.id, apiKeys[3].id, sevenDaysAgo, now, 15)
  );
  
  // Free customer usage
  allUsageData = allUsageData.concat(
    generateUsageData(freeCustomer.id, apiKeys[4].id, sevenDaysAgo, now, 5)
  );
  
  // Historical usage for inactive customer (stopped 30 days ago)
  const sixtyDaysAgo = subDays(now, 60);
  const thirtyDaysAgo = subDays(now, 30);
  allUsageData = allUsageData.concat(
    generateUsageData(inactiveCustomer.id, apiKeys[5].id, sixtyDaysAgo, thirtyDaysAgo, 10)
  );

  console.log(`📝 Inserting ${allUsageData.length} usage records...`);
  
  // Insert in batches
  const batchSize = 500;
  for (let i = 0; i < allUsageData.length; i += batchSize) {
    const batch = allUsageData.slice(i, i + batchSize);
    await prisma.usageHistory.createMany({ data: batch });
  }

  console.log('💳 Creating invoices...');
  
  let invoiceSequence = 1;
  
  // Create invoices for enterprise customer - proper monthly billing
  const enterpriseInvoices = [];
  
  // Calculate proper billing periods based on customer creation date
  for (let periodIndex = 0; periodIndex < 3; periodIndex++) {
    const periodStart = addMonths(enterpriseCustomer.createdAt, periodIndex);
    const periodEnd = addMonths(periodStart, 1);
    periodEnd.setDate(periodEnd.getDate() - 1); // Last day of period
    
    // Don't create future invoices
    if (periodStart > now) break;
    
    const isCurrentPeriod = now >= periodStart && now <= periodEnd;
    const isPastPeriod = periodEnd < now;
    
    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber: generateInvoiceNumber(periodStart, invoiceSequence++),
        customerId: enterpriseCustomer.id,
        periodStart: validateDate(periodStart, 'invoice period start'),
        periodEnd: validateDate(periodEnd, 'invoice period end'),
        totalUsage: isPastPeriod ? 36000 : (isCurrentPeriod ? 15000 : 0), // ~1200/day for full month
        amount: 499.00,
        status: isPastPeriod ? 'PAID' : 'PENDING',
        dueDate: validateDate(addDays(periodEnd, 15), 'invoice due date'),
        paidAt: isPastPeriod ? addDays(periodEnd, 5) : null
      }
    });
    
    await prisma.invoiceLineItem.create({
      data: {
        invoiceId: invoice.id,
        description: 'Enterprise Plan - Monthly Subscription',
        quantity: 1,
        unitPrice: 499.00,
        amount: 499.00
      }
    });
    
    console.log(`✅ Created invoice ${invoice.invoiceNumber} for period ${format(periodStart, 'yyyy-MM-dd')} to ${format(periodEnd, 'yyyy-MM-dd')}`);
  }

  // Pro customer - current period invoice
  const proPeriodStart = proCustomer.createdAt;
  const proPeriodEnd = addMonths(proPeriodStart, 1);
  proPeriodEnd.setDate(proPeriodEnd.getDate() - 1);
  
  if (proPeriodStart <= now) {
    const proInvoice = await prisma.invoice.create({
      data: {
        invoiceNumber: generateInvoiceNumber(proPeriodStart, invoiceSequence++),
        customerId: proCustomer.id,
        periodStart: validateDate(proPeriodStart, 'pro period start'),
        periodEnd: validateDate(proPeriodEnd, 'pro period end'),
        totalUsage: 750,
        amount: 99.00,
        status: 'PENDING',
        dueDate: validateDate(addDays(proPeriodEnd, 15), 'pro due date')
      }
    });
    
    await prisma.invoiceLineItem.create({
      data: {
        invoiceId: proInvoice.id,
        description: 'Pro Plan - Monthly Subscription',
        quantity: 1,
        unitPrice: 99.00,
        amount: 99.00
      }
    });
  }

  // Inactive customer - overdue invoice from 2 months ago
  const overduePeriodStart = inactiveCustomer.createdAt;
  const overduePeriodEnd = addMonths(overduePeriodStart, 1);
  overduePeriodEnd.setDate(overduePeriodEnd.getDate() - 1);
  
  const overdueInvoice = await prisma.invoice.create({
    data: {
      invoiceNumber: generateInvoiceNumber(overduePeriodStart, invoiceSequence++),
      customerId: inactiveCustomer.id,
      periodStart: validateDate(overduePeriodStart, 'overdue period start'),
      periodEnd: validateDate(overduePeriodEnd, 'overdue period end'),
      totalUsage: 300,
      amount: 29.00,
      status: 'OVERDUE',
      dueDate: validateDate(subDays(now, 45), 'overdue due date')
    }
  });
  
  await prisma.invoiceLineItem.create({
    data: {
      invoiceId: overdueInvoice.id,
      description: 'Starter Plan - Monthly Subscription',
      quantity: 1,
      unitPrice: 29.00,
      amount: 29.00
    }
  });

  console.log('✅ Database seeded successfully!');
  console.log(`\n📊 Summary:`);
  console.log(`- ${customers.length} customers created`);
  console.log(`- ${apiKeys.length} API keys created`);
  console.log(`- ${allUsageData.length} usage records created`);
  console.log(`- Multiple invoices with different statuses`);
  console.log('\n🔑 Test API Keys:');
  console.log('- Enterprise: ent_prod_key_123 (active)');
  console.log('- Enterprise: ent_dev_key_456 (inactive - should fail)');
  console.log('- Pro: pro_api_key_789');
  console.log('- Starter: starter_key_abc');
  console.log('- Free: free_test_key_xyz');
  console.log('- Expired: expired_key_999 (should fail)');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    console.error(e.stack);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });