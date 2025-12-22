import { EDeliveryWindow } from '../../common/interface/common.interface';
import { UserEntity } from '../../user/entities/user.entity';
import { TenantEntity } from '../../tenant/entities/tenant.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { OrderItemEntity } from './order-item.entity';

@Entity('order_master')
@Index(['orderNo'])
@Index(['distributorId'])
@Index(['tenantId'])
@Index(['status'])
@Index(['createdAt'])
export class OrderEntity {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ type: 'int', nullable: true })
  tenantId: number;

  @ManyToOne(() => TenantEntity, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenantId' })
  tenant: TenantEntity;

  @Column({ type: 'varchar', length: 255 })
  orderNo: string;

  @Column({ type: 'varchar', length: 50 })
  status: string;

  @Column({ type: 'int' })
  distributorId: number;

  @OneToMany(
    () => OrderItemEntity,
    (orderItemEntity) => orderItemEntity.order,
    { cascade: true },
  )
  orderItems: OrderItemEntity[];

  @ManyToOne(() => UserEntity)
  @JoinColumn({ name: 'distributorId' })
  distributor: UserEntity;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  totalAmount: number;

  @Column({ type: 'enum', enum: EDeliveryWindow, nullable: true })
  deliveryWindow: EDeliveryWindow | null;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;

  @ManyToOne(() => UserEntity, { nullable: true })
  @JoinColumn({ name: 'createdBy' })
  createdByUser: UserEntity;

  @Column({ type: 'int', nullable: true })
  createdBy: number;

  @ManyToOne(() => UserEntity, { nullable: true })
  @JoinColumn({ name: 'updatedBy' })
  updatedByUser: UserEntity;

  @Column({ type: 'int', nullable: true })
  updatedBy: number;

  @Column({ type: 'varchar', nullable: true })
  createdByIp: string;

  @Column({ type: 'varchar', nullable: true })
  updatedByIp: string;

  @Column({ type: 'varchar', default: 'pending' })
  paymentStatus: string;
}
