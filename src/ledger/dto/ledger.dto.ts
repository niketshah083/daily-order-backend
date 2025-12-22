import {
  IsNumber,
  IsOptional,
  IsString,
  IsEnum,
  IsDateString,
} from 'class-validator';

export class CreateLedgerEntryDto {
  @IsNumber()
  distributorId: number;

  @IsEnum(['debit', 'credit'])
  entryType: 'debit' | 'credit';

  @IsNumber()
  amount: number;

  @IsEnum(['order', 'payment', 'adjustment', 'opening'])
  referenceType: 'order' | 'payment' | 'adjustment' | 'opening';

  @IsOptional()
  @IsNumber()
  referenceId?: number;

  @IsString()
  narration: string;

  @IsOptional()
  @IsDateString()
  entryDate?: string;
}

export class RecordPaymentDto {
  @IsNumber()
  distributorId: number;

  @IsNumber()
  amount: number;

  @IsOptional()
  @IsString()
  paymentMode?: string; // cash, upi, bank, cheque

  @IsOptional()
  @IsString()
  referenceNo?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsDateString()
  paymentDate?: string;
}

export class AdjustmentDto {
  @IsNumber()
  distributorId: number;

  @IsEnum(['debit', 'credit'])
  entryType: 'debit' | 'credit';

  @IsNumber()
  amount: number;

  @IsString()
  narration: string;

  @IsOptional()
  @IsDateString()
  entryDate?: string;
}

export class LedgerQueryDto {
  @IsOptional()
  @IsNumber()
  distributorId?: number;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}
