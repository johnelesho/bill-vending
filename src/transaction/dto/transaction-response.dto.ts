// src/transactions/dto/transaction-response.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { TransactionStatus, TransactionType } from '../entities/transaction.entities';

export class TransactionResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ enum: TransactionType })
  type: TransactionType;

  @ApiProperty()
  amount: number;

  @ApiProperty({ enum: TransactionStatus })
  status: TransactionStatus;

  @ApiProperty({ required: false, nullable: true })
  referenceId?: string;

  @ApiProperty({ required: false, nullable: true })
  failureReason?: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
