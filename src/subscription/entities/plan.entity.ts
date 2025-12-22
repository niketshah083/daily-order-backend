import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { TenantPlanEntity } from './tenant-plan.entity';

export enum PlanType {
  BASE = 'base',
  ADDON = 'addon',
}

export enum BillingCycle {
  MONTHLY = 'monthly',
  YEARLY = 'yearly',
}

export interface PlanLimits {
  users?: number; // -1 = unlimited
  ordersPerMonth?: number;
  categories?: number;
  items?: number;
}

export interface PlanFeatures {
  whatsappIntegration?: boolean;
  analyticsBasic?: boolean;
  analyticsFull?: boolean;
  apiAccess?: boolean;
  prioritySupport?: boolean;
  customBranding?: boolean;
  exportReports?: boolean;
  multipleWarehouses?: boolean;
}

@Entity('plans')
@Index(['planType', 'isActive'])
export class PlanEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  slug: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'enum', enum: PlanType })
  planType: PlanType;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  price: number;

  @Column({ type: 'enum', enum: BillingCycle, default: BillingCycle.MONTHLY })
  billingCycle: BillingCycle;

  @Column({ type: 'json' })
  limits: PlanLimits;

  @Column({ type: 'json', nullable: true })
  features: PlanFeatures;

  @Column({ type: 'int', default: 0 })
  sortOrder: number;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'boolean', default: false })
  isPopular: boolean;

  @Column({ type: 'varchar', length: 50, nullable: true })
  badgeText: string; // e.g., "Most Popular", "Best Value"

  @OneToMany(() => TenantPlanEntity, (tenantPlan) => tenantPlan.plan)
  tenantPlans: TenantPlanEntity[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
