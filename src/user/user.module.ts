import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from './entities/user.entity';
import { DistributorEntity } from '../distributor/entities/distributor.entity';
import { UserController } from './user.controller';
import { AdminUserController } from './admin-user.controller';
import { UserService } from './user.service';
import { SubscriptionModule } from '../subscription/subscription.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserEntity, DistributorEntity]),
    forwardRef(() => SubscriptionModule),
  ],
  controllers: [UserController, AdminUserController],
  providers: [UserService],
  exports: [TypeOrmModule, UserService],
})
export class UserModule {}
