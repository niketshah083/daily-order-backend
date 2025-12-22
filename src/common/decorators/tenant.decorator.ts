import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const TenantId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): number | null => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;

    // No user (unauthenticated) - return null (no tenant filter)
    if (!user) {
      return null;
    }

    // master_admin has no tenant, can access all
    if (user.role === 'master_admin') {
      return null;
    }

    // super_admin and distributor must have tenantId
    return user.tenantId || null;
  },
);

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
