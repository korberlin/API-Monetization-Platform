import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Observable } from 'rxjs';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private configService: ConfigService) {}
  canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest();
    const adminKey = request.headers['x-admin-key'];

    if (!adminKey) {
      throw new UnauthorizedException('Missing Admin API key');
    }

    if (adminKey !== this.configService.get('ADMIN_API_KEY')) {
      throw new UnauthorizedException('Invalid Admin API key');
    }
    return true;
  }
}
