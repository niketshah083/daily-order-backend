import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SubscriptionService } from '../subscription.service';

export const LIMIT_TYPE_KEY = 'limitType';

export type LimitType = 'users' | 'ordersPerMonth' | 'categories' | 'items';

export const CheckLimit = (limitType: LimitType) => {
  return (target: any, key: string, descriptor: PropertyDescriptor) => {
    Reflect.defineMetadata(LIMIT_TYPE_KEY, limitType, descriptor.value);
    return descriptor;
  };
};

@Injectable()
export class UsageLimitGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private subscriptionService: SubscriptionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const limitType = this.reflector.get<LimitType>(
      LIMIT_TYPE_KEY,
      context.getHandler(),
    );

    if (!limitType) {
      return true; // No limit check required
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.tenantId) {
      return true; // No tenant context, skip check
    }

    // master_admin bypasses all limits
    if (user.role === 'master_admin') {
      return true;
    }

    const result = await this.subscriptionService.checkLimit(
      user.tenantId,
      limitType,
    );

    if (!result.allowed) {
      throw new ForbiddenException({
        statusCode: 403,
        error: 'Limit Exceeded',
        message: result.message,
        limitType,
        limit: result.limit,
        current: result.current,
        remaining: result.remaining,
        upgradeRequired: true,
      });
    }

    return true;
  }
}
