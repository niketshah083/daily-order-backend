import {
  IsString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsBoolean,
  IsObject,
  Min,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  PlanType,
  BillingCycle,
  PlanLimits,
  PlanFeatures,
} from '../entities/plan.entity';

export class PlanLimitsDto implements PlanLimits {
  @IsOptional()
  @IsNumber()
  users?: number;

  @IsOptional()
  @IsNumber()
  ordersPerMonth?: number;

  @IsOptional()
  @IsNumber()
  categories?: number;

  @IsOptional()
  @IsNumber()
  items?: number;
}

export class PlanFeaturesDto implements PlanFeatures {
  @IsOptional()
  @IsBoolean()
  whatsappIntegration?: boolean;

  @IsOptional()
  @IsBoolean()
  analyticsBasic?: boolean;

  @IsOptional()
  @IsBoolean()
  analyticsFull?: boolean;

  @IsOptional()
  @IsBoolean()
  apiAccess?: boolean;

  @IsOptional()
  @IsBoolean()
  prioritySupport?: boolean;

  @IsOptional()
  @IsBoolean()
  customBranding?: boolean;

  @IsOptional()
  @IsBoolean()
  exportReports?: boolean;

  @IsOptional()
  @IsBoolean()
  multipleWarehouses?: boolean;
}

export class CreatePlanDto {
  @IsString()
  @MaxLength(100)
  name: string;

  @IsString()
  @MaxLength(100)
  slug: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(PlanType)
  planType: PlanType;

  @IsNumber()
  @Min(0)
  price: number;

  @IsOptional()
  @IsEnum(BillingCycle)
  billingCycle?: BillingCycle;

  @IsObject()
  @ValidateNested()
  @Type(() => PlanLimitsDto)
  limits: PlanLimitsDto;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => PlanFeaturesDto)
  features?: PlanFeaturesDto;

  @IsOptional()
  @IsNumber()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  isPopular?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  badgeText?: string;
}
