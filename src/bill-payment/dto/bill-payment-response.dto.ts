import { ApiProperty } from '@nestjs/swagger';
import { BillPaymentStatus } from '../entities/BillPayment.entity';

export class BillPaymentResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  amount: number;

  @ApiProperty()
  billType: string;

  @ApiProperty()
  meterNumber: string;

  @ApiProperty({ enum: BillPaymentStatus })
  status: BillPaymentStatus;

  @ApiProperty()
  userId: string;

  @ApiProperty()
  transactionId: string;

  @ApiProperty({ required: false, nullable: true })
  referenceNumber?: string;

  @ApiProperty({ required: false, nullable: true })
  failureReason?: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}