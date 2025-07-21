export default () => ({
  port: parseInt(process.env.PORT || '3000', 10),
  analytics: {
    url: process.env.ANALYTICS_SERVICE_URL || 'http://localhost:3001',
  },
  billing: {
    url: process.env.BILLING_SERVICE_URL || 'http://localhost:3002',
  },
  api: {
    targetUrl: process.env.TARGET_API_URL || 'https://httpbin.org',
  },
});
