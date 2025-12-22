import { IsNumber, IsEnum, IsArray, ArrayNotEmpty } from 'class-validator';

export class UpdatePaymentStatusDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsNumber({}, { each: true })
  orderIds: number[];

  @IsEnum(['paid', 'unpaid', 'partial'])
  paymentStatus: 'paid' | 'unpaid' | 'partial';
}
