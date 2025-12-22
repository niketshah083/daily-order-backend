import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsBoolean,
  IsObject,
  IsEmail,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateTenantDto {
  @ApiProperty({ description: 'Tenant name' })
  @IsString()
  name: string;

  @ApiProperty({ description: 'Tenant slug (unique identifier)' })
  @IsString()
  slug: string;

  @ApiPropertyOptional({ description: 'Tenant description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Tenant logo URL' })
  @IsOptional()
  @IsString()
  logo?: string;

  @ApiPropertyOptional({ description: 'Is tenant active', default: true })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Tenant settings (JSON)' })
  @IsOptional()
  @IsObject()
  settings?: Record<string, any>;

  // Admin user fields
  @ApiProperty({ description: 'Admin first name' })
  @IsString()
  adminFirstName: string;

  @ApiProperty({ description: 'Admin last name' })
  @IsString()
  adminLastName: string;

  @ApiProperty({ description: 'Admin email' })
  @IsEmail()
  adminEmail: string;

  @ApiProperty({ description: 'Admin phone number' })
  @IsString()
  adminPhoneNo: string;

  @ApiPropertyOptional({
    description: 'Admin password (auto-generated if not provided)',
  })
  @IsOptional()
  @IsString()
  adminPassword?: string;
}
