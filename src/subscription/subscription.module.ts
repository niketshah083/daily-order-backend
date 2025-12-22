import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlanEntity } from './entities/plan.entity';
import { TenantPlanEntity } from './entities/tenant-plan.entity';
import { UsageEntity } from './entities/usage.entity';
import { SubscriptionService } from './subscription.service';
import { SubscriptionController } from './subscription.controller';
import { UsageLimitGuard } from './guards/usage-limit.guard';
import { SubscriptionGuard } from './guards/subscription.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([PlanEntity, TenantPlanEntity, UsageEntity]),
  ],
  controllers: [SubscriptionController],
  providers: [SubscriptionService, UsageLimitGuard, SubscriptionGuard],
  exports: [SubscriptionService, UsageLimitGuard, SubscriptionGuard],
})
export class SubscriptionModule {}
