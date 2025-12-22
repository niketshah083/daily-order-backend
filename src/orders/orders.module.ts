import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrderEntity } from './entities/order.entity';
import { OrderItemEntity } from './entities/order-item.entity';
import { ItemMasterEntity } from '../item-master/entities/item-master.entity';
import { UserEntity } from '../user/entities/user.entity';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { S3Service } from '../common/services/s3.service';
import { SubscriptionModule } from '../subscription/subscription.module';
import { LedgerModule } from '../ledger/ledger.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      OrderEntity,
      OrderItemEntity,
      ItemMasterEntity,
      UserEntity,
    ]),
    forwardRef(() => SubscriptionModule),
    forwardRef(() => LedgerModule),
  ],
  providers: [OrdersService, S3Service],
  controllers: [OrdersController],
  exports: [OrdersService],
})
export class OrdersModule {}
