import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';

// Stricter than OwnerSessionGuard — requires the 'owner' role, not just any
// logged-in owner-dashboard session. Use for staff-management routes only.
@Injectable()
export class OwnerOnlyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    if (!req.session?.ownerId) {
      throw new UnauthorizedException({ error: 'unauthorized' });
    }
    if (req.session.ownerRole !== 'owner') {
      throw new ForbiddenException({ error: 'owner_role_required' });
    }
    return true;
  }
}
