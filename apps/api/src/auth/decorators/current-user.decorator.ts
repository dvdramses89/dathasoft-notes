import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { PublicUser } from '../auth.service';

// Extrae el usuario autenticado (inyectado por JwtStrategy en request.user).
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): PublicUser => {
    const request = ctx.switchToHttp().getRequest<{ user: PublicUser }>();
    return request.user;
  },
);
