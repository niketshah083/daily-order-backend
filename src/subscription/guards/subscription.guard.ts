import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SubscriptionService } from '../subscription.service';

export const SKIP_SUBSCRIPTION_CHECK = 'skipSubscriptionCheck';

@Injectable()
export class SubscriptionGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private subscriptionService: SubscriptionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Check if route is marked to skip subscription check
    const skipCheck = this.reflector.getAllAndOverride<boolean>(
      SKIP_SUBSCRIPTION_CHECK,
      [context.getHandler(), context.getClass()],
    );

    if (skipCheck) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // No user = let auth guard handle it
    if (!user) {
      return true;
    }

    // master_admin doesn't need subscription
    if (user.role === 'master_admin') {
      return true;
    }

    // No tenant = skip check (shouldn't happen but safety)
    if (!user.tenantId) {
      return true;
    }

    // Check if tenant has active subscription
    const isActive = await this.subscriptionService.isSubscriptionActive(
      user.tenantId,
    );

    if (!isActive) {
      throw new ForbiddenException(
        'Your subscription has expired or is inactive. Please upgrade your plan to continue.',
      );
    }

    return true;
  }
}
