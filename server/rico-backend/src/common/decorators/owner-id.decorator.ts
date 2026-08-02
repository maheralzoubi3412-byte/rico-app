import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

export const OwnerId = createParamDecorator((_data: unknown, ctx: ExecutionContext): string => {
  const req = ctx.switchToHttp().getRequest<Request>();
  return req.session.ownerId as string;
});
