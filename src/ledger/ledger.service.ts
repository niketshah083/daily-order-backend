import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, LessThanOrEqual } from 'typeorm';
import { LedgerEntryEntity } from './entities/ledger-entry.entity';
import { UserEntity } from '../user/entities/user.entity';
import {
  CreateLedgerEntryDto,
  RecordPaymentDto,
  AdjustmentDto,
} from './dto/ledger.dto';

@Injectable()
export class LedgerService {
  constructor(
    @InjectRepository(LedgerEntryEntity)
    private ledgerRepo: Repository<LedgerEntryEntity>,
    @InjectRepository(UserEntity)
    private userRepo: Repository<UserEntity>,
  ) {}

  // Get current balance for a distributor
  async getDistributorBalance(
    distributorId: number,
    tenantId: number,
  ): Promise<number> {
    const lastEntry = await this.ledgerRepo.findOne({
      where: { distributorId, tenantId },
      order: { id: 'DESC' },
    });
    return lastEntry ? Number(lastEntry.runningBalance) : 0;
  }

  // Create a debit entry (when order is created - distributor owes money)
  async createDebitEntry(
    distributorId: number,
    amount: number,
    referenceType: 'order' | 'adjustment' | 'opening',
    referenceId: number | null,
    narration: string,
    tenantId: number,
    userId: number,
  ): Promise<LedgerEntryEntity> {
    const currentBalance = await this.getDistributorBalance(
      distributorId,
      tenantId,
    );
    const newBalance = currentBalance + amount;

    const entry = this.ledgerRepo.create({
      distributorId,
      tenantId,
      entryType: 'debit',
      amount,
      runningBalance: newBalance,
      referenceType,
      referenceId,
      narration,
      entryDate: new Date(),
      createdBy: userId,
    });

    return this.ledgerRepo.save(entry);
  }

  // Create a credit entry (when payment is received - reduces outstanding)
  async createCreditEntry(
    distributorId: number,
    amount: number,
    referenceType: 'order' | 'payment' | 'adjustment',
    referenceId: number | null,
    narration: string,
    tenantId: number,
    userId: number,
  ): Promise<LedgerEntryEntity> {
    const currentBalance = await this.getDistributorBalance(
      distributorId,
      tenantId,
    );
    const newBalance = currentBalance - amount;

    const entry = this.ledgerRepo.create({
      distributorId,
      tenantId,
      entryType: 'credit',
      amount,
      runningBalance: newBalance,
      referenceType,
      referenceId,
      narration,
      entryDate: new Date(),
      createdBy: userId,
    });

    return this.ledgerRepo.save(entry);
  }

  // Called when order is created
  async onOrderCreated(
    orderId: number,
    orderNo: string,
    distributorId: number,
    amount: number,
    tenantId: number,
    userId: number,
  ): Promise<LedgerEntryEntity> {
    return this.createDebitEntry(
      distributorId,
      amount,
      'order',
      orderId,
      `Order ${orderNo} - Sale`,
      tenantId,
      userId,
    );
  }

  // Called when order payment status changes to paid
  async onPaymentReceived(
    orderId: number,
    orderNo: string,
    distributorId: number,
    amount: number,
    tenantId: number,
    userId: number,
  ): Promise<LedgerEntryEntity> {
    return this.createCreditEntry(
      distributorId,
      amount,
      'payment',
      orderId,
      `Payment received for Order ${orderNo}`,
      tenantId,
      userId,
    );
  }

  // Called when order is cancelled (reverse the debit)
  async onOrderCancelled(
    orderId: number,
    orderNo: string,
    distributorId: number,
    amount: number,
    tenantId: number,
    userId: number,
  ): Promise<LedgerEntryEntity> {
    return this.createCreditEntry(
      distributorId,
      amount,
      'order',
      orderId,
      `Order ${orderNo} - Cancelled (Reversal)`,
      tenantId,
      userId,
    );
  }

  // Record manual payment
  async recordPayment(
    dto: RecordPaymentDto,
    tenantId: number,
    userId: number,
  ): Promise<LedgerEntryEntity> {
    const distributor = await this.userRepo.findOne({
      where: { id: dto.distributorId, tenantId, role: 'distributor' },
    });

    if (!distributor) {
      throw new NotFoundException('Distributor not found');
    }

    const narration = dto.notes
      ? `Payment received - ${dto.paymentMode || 'Cash'} - ${dto.notes}`
      : `Payment received - ${dto.paymentMode || 'Cash'}${dto.referenceNo ? ` (Ref: ${dto.referenceNo})` : ''}`;

    return this.createCreditEntry(
      dto.distributorId,
      dto.amount,
      'payment',
      null,
      narration,
      tenantId,
      userId,
    );
  }

  // Create adjustment entry
  async createAdjustment(
    dto: AdjustmentDto,
    tenantId: number,
    userId: number,
  ): Promise<LedgerEntryEntity> {
    const distributor = await this.userRepo.findOne({
      where: { id: dto.distributorId, tenantId, role: 'distributor' },
    });

    if (!distributor) {
      throw new NotFoundException('Distributor not found');
    }

    if (dto.entryType === 'debit') {
      return this.createDebitEntry(
        dto.distributorId,
        dto.amount,
        'adjustment',
        null,
        dto.narration,
        tenantId,
        userId,
      );
    } else {
      return this.createCreditEntry(
        dto.distributorId,
        dto.amount,
        'adjustment',
        null,
        dto.narration,
        tenantId,
        userId,
      );
    }
  }

  // Get ledger statement for a distributor
  async getLedgerStatement(
    distributorId: number,
    tenantId: number,
    startDate?: string,
    endDate?: string,
  ) {
    const queryBuilder = this.ledgerRepo
      .createQueryBuilder('ledger')
      .leftJoinAndSelect('ledger.distributor', 'distributor')
      .leftJoinAndSelect('distributor.distributor', 'distributorDetails')
      .where('ledger.tenantId = :tenantId', { tenantId })
      .andWhere('ledger.distributorId = :distributorId', { distributorId });

    if (startDate && endDate) {
      queryBuilder.andWhere(
        'ledger.entryDate BETWEEN :startDate AND :endDate',
        {
          startDate,
          endDate,
        },
      );
    } else if (startDate) {
      queryBuilder.andWhere('ledger.entryDate >= :startDate', { startDate });
    } else if (endDate) {
      queryBuilder.andWhere('ledger.entryDate <= :endDate', { endDate });
    }

    queryBuilder.orderBy('ledger.id', 'ASC');

    const entries = await queryBuilder.getMany();

    // Calculate opening balance if date filter is applied
    let openingBalance = 0;
    if (startDate) {
      const previousEntry = await this.ledgerRepo.findOne({
        where: {
          distributorId,
          tenantId,
          entryDate: LessThanOrEqual(new Date(startDate)),
        },
        order: { id: 'DESC' },
      });
      openingBalance = previousEntry ? Number(previousEntry.runningBalance) : 0;
    }

    // Get distributor info
    const distributor = await this.userRepo.findOne({
      where: { id: distributorId },
      relations: ['distributor'],
    });

    // Calculate totals
    const totalDebit = entries
      .filter((e) => e.entryType === 'debit')
      .reduce((sum, e) => sum + Number(e.amount), 0);

    const totalCredit = entries
      .filter((e) => e.entryType === 'credit')
      .reduce((sum, e) => sum + Number(e.amount), 0);

    const closingBalance =
      entries.length > 0
        ? Number(entries[entries.length - 1].runningBalance)
        : openingBalance;

    return {
      distributor: {
        id: distributor?.id,
        name: `${distributor?.firstName} ${distributor?.lastName}`,
        businessName: distributor?.distributor?.businessName,
        phone: distributor?.phoneNo,
      },
      openingBalance,
      entries,
      totalDebit,
      totalCredit,
      closingBalance,
    };
  }

  // Get all distributors with their outstanding balance
  async getOutstandingReport(tenantId: number) {
    const distributors = await this.userRepo.find({
      where: { tenantId, role: 'distributor' },
      relations: ['distributor'],
    });

    const report = await Promise.all(
      distributors.map(async (dist) => {
        const balance = await this.getDistributorBalance(dist.id, tenantId);

        // Get last transaction date
        const lastEntry = await this.ledgerRepo.findOne({
          where: { distributorId: dist.id, tenantId },
          order: { id: 'DESC' },
        });

        return {
          distributorId: dist.id,
          name: `${dist.firstName} ${dist.lastName}`,
          businessName: dist.distributor?.businessName,
          phone: dist.phoneNo,
          outstandingBalance: balance,
          lastTransactionDate: lastEntry?.entryDate || null,
        };
      }),
    );

    // Sort by outstanding balance (highest first)
    report.sort((a, b) => b.outstandingBalance - a.outstandingBalance);

    const totalOutstanding = report.reduce(
      (sum, r) => sum + r.outstandingBalance,
      0,
    );

    return {
      distributors: report,
      totalOutstanding,
      totalDistributors: report.length,
      distributorsWithBalance: report.filter((r) => r.outstandingBalance > 0)
        .length,
    };
  }

  // Get summary for dashboard
  async getLedgerSummary(tenantId: number) {
    const outstanding = await this.getOutstandingReport(tenantId);

    // Get today's collections using query builder for proper date comparison
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay = new Date(today.setHours(23, 59, 59, 999));

    const todayCredits = await this.ledgerRepo
      .createQueryBuilder('ledger')
      .where('ledger.tenantId = :tenantId', { tenantId })
      .andWhere('ledger.entryType = :entryType', { entryType: 'credit' })
      .andWhere('ledger.referenceType = :referenceType', {
        referenceType: 'payment',
      })
      .andWhere('ledger.createdAt BETWEEN :startOfDay AND :endOfDay', {
        startOfDay,
        endOfDay,
      })
      .getMany();

    const todayCollection = todayCredits.reduce(
      (sum, e) => sum + Number(e.amount),
      0,
    );

    return {
      totalOutstanding: outstanding.totalOutstanding,
      totalDistributors: outstanding.totalDistributors,
      distributorsWithBalance: outstanding.distributorsWithBalance,
      todayCollection,
    };
  }
}
