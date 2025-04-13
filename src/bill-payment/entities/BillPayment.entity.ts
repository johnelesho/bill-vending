import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Transaction } from 'src/transaction/entities/transaction.entities';

export enum BillType {
  ELECTRICITY = 'ELECTRICITY',
  WATER = 'WATER',
  INTERNET = 'INTERNET',
  CABLE_TV = 'CABLE_TV',
}

export enum BillPaymentStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

@Entity('bill_payments')
export class BillPayment {
  @PrimaryGeneratedColumn('uuid')
  @ApiProperty({ description: 'Unique identifier for the bill payment' })
  id: string;

  @Column({ type: 'enum', enum: BillType })
  @ApiProperty({
    description: 'Type of bill being paid',
    enum: BillType,
  })
  billType: BillType;

  @Column()
  @ApiProperty({ description: 'Bill reference number or meter number' })
  billReference: string;

  @Column({ nullable: true })
  @ApiProperty({ description: 'Customer name associated with the bill' })
  customerName: string;

  @Column({
    type: 'enum',
    enum: BillPaymentStatus,
    default: BillPaymentStatus.PENDING,
  })
  @ApiProperty({
    description: 'Current status of the bill payment',
    enum: BillPaymentStatus,
  })
  status: BillPaymentStatus;

  @Column({ nullable: true })
  @ApiProperty({
    description: 'External reference ID from the service provider',
  })
  externalReference: string;

  @Column({ nullable: true })
  @ApiProperty({
    description: 'Token generated for prepaid services (e.g., electricity)',
  })
  token: string;

  @Column({ nullable: true, type: 'jsonb' })
  @ApiProperty({ description: 'Additional data related to the bill payment' })
  additionalData: Record<string, any>;

  @OneToOne(() => Transaction, (transaction) => transaction.billPayment)
  @JoinColumn({ name: 'transactionId' })
  transaction: Transaction;

  @Column()
  transactionId: string;

  @CreateDateColumn()
  @ApiProperty({ description: 'Bill payment creation timestamp' })
  createdAt: Date;

  @UpdateDateColumn()
  @ApiProperty({ description: 'Bill payment last update timestamp' })
  updatedAt: Date;
}
