import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { CommonConstants } from '../../common/constants/common.constant';
import { CategoryEntity } from '../../category/entities/category.entity';
import { TenantEntity } from '../../tenant/entities/tenant.entity';

@Entity('item_masters')
export class ItemMasterEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int', nullable: true })
  tenantId: number;

  @ManyToOne(() => TenantEntity, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenantId' })
  tenant: TenantEntity;

  @Column({ type: 'int', nullable: true })
  categoryId: number;

  @ManyToOne(() => CategoryEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'categoryId' })
  category: CategoryEntity;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 50 })
  unit: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  qty: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  rate: number;

  @Column({
    type: 'json',
    nullable: true,
    transformer: CommonConstants.stringToJsonTransformer(),
  })
  assets: string[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
