import { Injectable } from '@nestjs/common';
import { ApiKeyData } from 'src/interfaces/apiKeyData.interface';
import { PrismaService } from 'src/prisma/prisma.service';
import { RedisService } from 'src/redis/redis.service';

@Injectable()
export class CustomerService {
  constructor(
    private prismaService: PrismaService,
    private redisService: RedisService,
  ) {}

  async findByApiKey(apiKey: string): Promise<ApiKeyData | null> {
    const redisCacheKey = `customer:apiKey:${apiKey}`;
    try {
      const cachedData = await this.redisService.get(redisCacheKey);
      if (cachedData) {
        console.log(`Cache hit for API key: ${apiKey}`);
        return JSON.parse(cachedData);
      }
    } catch (error) {
      console.error('Redis error, falling back to database:', error);
      // Continue to database even if Redis fails
    }

    console.log(`Cache miss for API key: ${apiKey}, querying database`);

    const apiKeyData = await this.prismaService.apiKey.findFirst({
      where: {
        key: apiKey,
      },
      include: {
        customer: {
          include: {
            developer: true,
            tier: true,
          },
        },
      },
    });
    if (!apiKeyData) {
      return null;
    }
    console.log(apiKeyData);
    if (!apiKeyData.isActive) {
      console.log(`API key ${apiKey} is inactive`);
      return null;
    }
    if (apiKeyData.expiresAt && new Date(apiKeyData.expiresAt) < new Date()) {
      console.log(`API key ${apiKey} has expired`);
      return null;
    }
    if (!apiKeyData.customer.isActive) {
      console.log(`Customer for API key ${apiKey} is inactive`);
      return null;
    }
    const ret = {
      customer: {
        id: apiKeyData.customer.id,
        email: apiKeyData.customer.email,
        tier: apiKeyData.customer.tier,
        rateLimit: apiKeyData.customer.tier.rateLimit,
      },
      developer: {
        id: apiKeyData.customer.developer.id,
        name: apiKeyData.customer.developer.name,
        apiUrl: apiKeyData.customer.developer.apiUrl,
      },
      apiKey: {
        id: apiKeyData.id,
        isActive: apiKeyData.isActive,
        expiresAt: apiKeyData.expiresAt,
      },
    };
    await this.redisService.setex(redisCacheKey, 300, JSON.stringify(ret));
    return ret;
  }
}
