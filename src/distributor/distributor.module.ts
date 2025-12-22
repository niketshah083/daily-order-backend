import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DistributorEntity } from './entities/distributor.entity';

@Module({
  imports: [TypeOrmModule.forFeature([DistributorEntity])],
  exports: [TypeOrmModule],
})
export class DistributorModule {}
