import {
  IsNumber,
  IsOptional,
  IsBoolean,
  IsString,
  IsEnum,
  Min,
  IsDateString,
} from 'class-validator';
import { SubscriptionStatus } from '../entities/tenant-plan.entity';

export class AssignPlanDto {
  @IsNumber()
  tenantId: number;

  @IsNumber()
  planId: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  quantity?: number; // For addons

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsBoolean()
  autoRenew?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  pricePaid?: number;

  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @IsOptional()
  @IsString()
  transactionId?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateTenantPlanDto {
  @IsOptional()
  @IsEnum(SubscriptionStatus)
  status?: SubscriptionStatus;

  @IsOptional()
  @IsNumber()
  @Min(1)
  quantity?: number;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsBoolean()
  autoRenew?: boolean;

  @IsOptional()
  @IsString()
  cancellationReason?: string;
}

export class UpgradePlanDto {
  @IsNumber()
  tenantId: number;

  @IsNumber()
  newPlanId: number;

  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @IsOptional()
  @IsString()
  transactionId?: string;
}

export class PurchaseAddonDto {
  @IsNumber()
  tenantId: number;

  @IsNumber()
  addonPlanId: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  quantity?: number;

  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @IsOptional()
  @IsString()
  transactionId?: string;
}
