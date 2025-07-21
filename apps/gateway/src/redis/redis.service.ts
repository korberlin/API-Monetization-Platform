import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';

@Injectable()
export class RedisService {
  private redis: Redis;

  constructor(private configService: ConfigService) {
    const redisUrl: string = configService.get('REDIS_URL') || 'redis://localhost:6379';
    this.redis = new Redis(redisUrl);

    this.redis.on('connect', () => {
      console.log('Connected to Redis');
    });

    this.redis.on('error', (err) => {
      console.error('Redis connection error:', err);
    });
  }

  async setex(key: string, ttl: number, value: string) {
    await this.redis.setex(key, ttl, value);
  }

  async get(key: string): Promise<string | null> {
    return this.redis.get(key);
  }

  async set(key: string, value: string): Promise<void> {
    await this.redis.set(key, value);
  }

  async keys(pattern: string): Promise<string[]> {
    return this.redis.keys(pattern);
  }

  async lpush(key: string, value: string): Promise<number> {
    return this.redis.lpush(key, value);
  }

  async lrange(key: string, start: number, stop: number): Promise<string[]> {
    return this.redis.lrange(key, start, stop);
  }

  async ltrim(key: string, start: number, stop: number): Promise<string> {
    return this.redis.ltrim(key, start, stop);
  }

  async del(key: string): Promise<number> {
    return this.redis.del(key);
  }

  async exists(key: string): Promise<number> {
    return this.redis.exists(key);
  }

  async expire(key: string, seconds: number): Promise<number> {
    return this.redis.expire(key, seconds);
  }

  async hgetAll(key: string): Promise<Record<string, string>> {
    return await this.redis.hgetall(key);
  }

  async hset(key: string, field: string, value: any): Promise<void> {
    await this.redis.hset(key, field, value);
  }

  async hget(key: string, field: string): Promise<any> {
    return await this.redis.hget(key, field);
  }

  async hincrby(key: string, field: string, increment: number): Promise<void> {
    await this.redis.hincrby(key, field, increment);
  }
}
