import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenantEntity } from './entities/tenant.entity';
import { OrderEntity } from '../orders/entities/order.entity';
import { UserEntity } from '../user/entities/user.entity';
import { PlanEntity } from '../subscription/entities/plan.entity';
import { TenantController } from './tenant.controller';
import { TenantService } from './tenant.service';
import { SubscriptionModule } from '../subscription/subscription.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TenantEntity,
      OrderEntity,
      UserEntity,
      PlanEntity,
    ]),
    forwardRef(() => SubscriptionModule),
  ],
  controllers: [TenantController],
  providers: [TenantService],
  exports: [TenantService],
})
export class TenantModule {}
