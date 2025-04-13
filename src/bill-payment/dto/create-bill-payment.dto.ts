import { ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsPositive,
  IsString,
  MinLength,
} from 'class-validator';
import { BillType } from '../entities/BillPayment.entity';

export class CreateBillPaymentDto {
  @ApiProperty({
    enum: BillType,
    example: BillType.ELECTRICITY,
    description: 'Type of bill to pay',
  })
  @IsEnum(BillType, { message: 'Invalid bill type' })
  @IsNotEmpty({ message: 'Bill type is required' })
  billType: BillType;

  @ApiProperty({
    example: '123456789',
    description: 'Bill reference or meter number',
  })
  @IsString({ message: 'Bill reference must be a string' })
  @MinLength(3, {
    message: 'Bill reference must be at least 3 characters long',
  })
  @IsNotEmpty({ message: 'Bill reference is required' })
  billReference: string;

  @ApiProperty({ example: 5000, description: 'Amount to pay for the bill' })
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'Amount must be a number with at most 2 decimal places' },
  )
  @IsPositive({ message: 'Amount must be positive' })
  @IsNotEmpty({ message: 'Amount is required' })
  amount: number;

  @ApiProperty({ example: 'John Doe', description: 'Customer name' })
  @IsString({ message: 'Customer name must be a string' })
  @IsNotEmpty({ message: 'Customer name is required' })
  customerName: string;

  @ApiProperty({ example: '1234567890' })
  @IsString()
  @IsNotEmpty()
  meterNumber: string;
}
