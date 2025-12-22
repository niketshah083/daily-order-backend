import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';
import { TenantEntity } from '../../tenant/entities/tenant.entity';

@Entity('usage_tracking')
@Unique(['tenantId', 'periodMonth'])
export class UsageEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  tenantId: number;

  @ManyToOne(() => TenantEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenantId' })
  tenant: TenantEntity;

  @Column({ type: 'varchar', length: 7 }) // Format: YYYY-MM
  periodMonth: string;

  @Column({ type: 'int', default: 0 })
  usersCount: number;

  @Column({ type: 'int', default: 0 })
  ordersCount: number;

  @Column({ type: 'int', default: 0 })
  categoriesCount: number;

  @Column({ type: 'int', default: 0 })
  itemsCount: number;

  @Column({ type: 'int', default: 0 })
  apiCallsCount: number;

  @Column({ type: 'bigint', default: 0 })
  storageUsedBytes: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
