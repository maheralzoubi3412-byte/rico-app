import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const expected = process.env.ADMIN_TOKEN;
    const auth = req.headers.authorization ?? '';
    if (!expected || auth !== `Bearer ${expected}`) {
      throw new UnauthorizedException({ error: 'unauthorized' });
    }
    return true;
  }
}
