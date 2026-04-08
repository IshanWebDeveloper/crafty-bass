import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: string;
  [key: string]: unknown;
}

interface RequestWithUser extends Request {
  user?: SessionUser;
  session?: {
    [key: string]: unknown;
  };
}

export const CurrentUser = createParamDecorator(
  (data: keyof SessionUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;
    return data ? user?.[data] : user;
  },
);
