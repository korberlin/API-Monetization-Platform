export interface ApiKeyData {
  customer: {
    id: number;
    email: string;
    tier: any; // or create a proper Tier interface
    rateLimit: number;
  };
  developer: {
    id: number;
    name: string;
    apiUrl: string;
  };
  apiKey: {
    id: number;
    isActive: boolean;
    expiresAt: Date | null;
  };
}
