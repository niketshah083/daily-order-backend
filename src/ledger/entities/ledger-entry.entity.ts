import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { UserEntity } from '../../user/entities/user.entity';
import { TenantEntity } from '../../tenant/entities/tenant.entity';

export type LedgerEntryType = 'debit' | 'credit';
export type LedgerReferenceType =
  | 'order'
  | 'payment'
  | 'adjustment'
  | 'opening';

@Entity('ledger_entries')
@Index(['distributorId'])
@Index(['tenantId'])
@Index(['entryDate'])
@Index(['referenceType', 'referenceId'])
export class LedgerEntryEntity {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ type: 'int' })
  tenantId: number;

  @ManyToOne(() => TenantEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenantId' })
  tenant: TenantEntity;

  @Column({ type: 'int' })
  distributorId: number;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'distributorId' })
  distributor: UserEntity;

  @Column({ type: 'enum', enum: ['debit', 'credit'] })
  entryType: LedgerEntryType;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  runningBalance: number;

  @Column({ type: 'enum', enum: ['order', 'payment', 'adjustment', 'opening'] })
  referenceType: LedgerReferenceType;

  @Column({ type: 'int', nullable: true })
  referenceId: number | null;

  @Column({ type: 'varchar', length: 500 })
  narration: string;

  @Column({ type: 'date' })
  entryDate: Date;

  @Column({ type: 'int', nullable: true })
  createdBy: number;

  @ManyToOne(() => UserEntity, { nullable: true })
  @JoinColumn({ name: 'createdBy' })
  createdByUser: UserEntity;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;
}
