import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as express from 'express';
import { join } from 'path';
import { NestExpressApplication } from '@nestjs/platform-express';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.useStaticAssets(join(__dirname, '..', 'public'));
  const port = 3000;

  const config = new DocumentBuilder()
    .setTitle('API Monetization Platform')
    .setDescription(
      `
      ## 🚀 Enterprise API Gateway & Monetization Platform

      Transform any API into a revenue-generating service with enterprise-grade features for billing, analytics, and access control.

      ### 🎯 Overview
      This platform acts as a smart proxy layer between your API and your customers, handling all aspects of API monetization including usage tracking, billing, rate limiting, and analytics - allowing you to focus on your core API functionality.

      ### ✨ Key Features

      **📊 Real-time Analytics**
      - Track API usage, performance metrics, and error rates
      - Monitor customer activity and endpoint popularity
      - Export detailed usage reports

      **💳 Automated Billing**
      - Flexible tier-based pricing models
      - Usage-based billing with automatic overage calculations
      - Monthly invoice generation and payment tracking
      - Pro-rated upgrades/downgrades

      **🛡️ Rate Limiting & Security**
      - Configurable rate limits per pricing tier
      - API key authentication and management
      - Request quota enforcement
      - DDoS protection (configurable)

      **🔧 Developer Experience**
      - Simple integration - just change your API endpoint
      - Comprehensive REST API for customer portals
      - Real-time usage monitoring
      - Detailed API documentation

      ### 🚦 Getting Started

      1. **Get Your API Key**
         - Sign up and obtain your API key from the dashboard
         - Each key is tied to a specific pricing tier

      2. **Add Authentication**
         - Include your API key in the \`x-api-key\` header
         - Example: \`x-api-key: your-api-key-here\`

      3. **Route Through Gateway**
         - Replace your API endpoint with: \`http://localhost:3000/api/*\`
         - All requests are proxied to the configured target API

      4. **Monitor Usage**
         - Check your usage at: \`GET /analytics/usage/current\`
         - View billing at: \`GET /billing/current-period\`

      ### 📝 Example Request

      \`\`\`bash
      curl -X GET http://localhost:3000/api/users \\
        -H "x-api-key: your-api-key-here" \\
        -H "Content-Type: application/json"
      \`\`\`

      ### 🏗️ Architecture

      Built with a microservices architecture for scalability:
      - **Gateway Service**: Request routing and rate limiting
      - **Analytics Service**: Usage tracking and metrics
      - **Billing Service**: Invoice generation and payment processing
      - **PostgreSQL**: Data persistence
      - **Redis**: Caching and rate limiting

      ### 📦 Tech Stack
      - NestJS / TypeScript
      - PostgreSQL with Prisma ORM
      - Redis for caching
      - Docker & Docker Compose
      - BullMQ for job processing

      ### 🔗 Links
      - **GitHub**: [github.com/korberlin](https://github.com/korberlin)
      - **Dashboard**: [http://localhost:3000/dashboard.html](http://localhost:3000/dashboard.html)
      
      ### 📧 Contact
      - **Developer**: korberlin
      - **Project**: API Monetization Platform
      `,
    )
    .setVersion('1.0')
    .setContact('korberlin', 'https://github.com/korberlin', 'gorkemm.koksal@gmail.com')
    .addApiKey(
      {
        type: 'apiKey',
        name: 'x-api-key',
        in: 'header',
        description: 'Customer API key for accessing proxied endpoints and viewing analytics/billing data',
      },
      'api-key',
    )
    .addApiKey(
      {
        type: 'apiKey',
        name: 'x-admin-key',
        in: 'header',
        description: 'Administrative API key for platform management operations',
      },
      'admin-key',
    )
    .addTag('Proxy', '🌐 API gateway proxy endpoints - all customer API traffic flows through here')
    .addTag('Analytics', '📊 Usage analytics, metrics, and performance monitoring')
    .addTag('Billing', '💳 Billing cycles, invoicing, pricing tiers, and payment management')
    .addTag('Admin', '🔧 Administrative operations for platform management (requires admin key)')
    .addServer('http://localhost:3000', 'Local Development')
    .build();

  const document = SwaggerModule.createDocument(app as any, config);
  SwaggerModule.setup('docs', app as any, document, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'API Monetization Platform - API Documentation',
    customfavIcon: 'https://nestjs.com/img/logo_text.svg',
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
    },
  });

  await app.listen(port);
  console.log(`Gateway service is running on: http://localhost:${port}`);
  console.log(`API Documentation available at: http://localhost:${port}/docs`);
  console.log(`Dashboard available at: http://localhost:${port}/dashboard.html`);
}
bootstrap().catch(console.error);
