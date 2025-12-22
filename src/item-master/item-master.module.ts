import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ItemMasterEntity } from './entities/item-master.entity';
import { ItemMasterController } from './item-master.controller';
import { ItemMasterService } from './item-master.service';
import { SubscriptionModule } from '../subscription/subscription.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ItemMasterEntity]),
    forwardRef(() => SubscriptionModule),
  ],
  controllers: [ItemMasterController],
  providers: [ItemMasterService],
  exports: [ItemMasterService],
})
export class ItemMasterModule {}
