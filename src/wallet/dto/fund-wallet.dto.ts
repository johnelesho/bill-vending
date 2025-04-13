import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsPositive, Min } from 'class-validator';

export class FundWalletDto {
  @ApiProperty({ example: 1000, description: 'Amount to add to wallet' })
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'Amount must be a number with at most 2 decimal places' },
  )
  @IsPositive({ message: 'Amount must be positive' })
  @IsNotEmpty({ message: 'Amount is required' })
  @Min(1)
  amount: number;
}
