import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToOne,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Wallet } from '../../wallets/entities/wallet.entity';
import { BillPayment } from '../../bill-payments/entities/bill-payment.entity';

export enum TransactionType {
  WALLET_FUNDING = 'WALLET_FUNDING',
  BILL_PAYMENT = 'BILL_PAYMENT',
  REFUND = 'REFUND',
}

export enum TransactionStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  REVERSED = 'REVERSED',
}

@Entity('transactions')
export class Transaction {
  @PrimaryGeneratedColumn('uuid')
  @ApiProperty({ description: 'Unique identifier for the transaction' })
  id: string;

  @Column({
    type: 'enum',
    enum: TransactionType,
  })
  @ApiProperty({
    description: 'Type of transaction',
    enum: TransactionType,
  })
  type: TransactionType;

  @Column({ type: 'decimal', precision: 20, scale: 2 })
  @ApiProperty({ description: 'Transaction amount' })
  amount: number;

  @Column({
    type: 'enum',
    enum: TransactionStatus,
    default: TransactionStatus.PENDING,
  })
  @ApiProperty({
    description: 'Current status of the transaction',
    enum: TransactionStatus,
  })
  status: TransactionStatus;

  @Column({ nullable: true })
  @ApiProperty({
    description: 'Reference to a related transaction (e.g., for refunds)',
  })
  referenceTransactionId: string;

  @Column({ nullable: true, type: 'jsonb' })
  @ApiProperty({ description: 'Metadata related to the transaction' })
  metadata: Record<string, any>;

  @ManyToOne(() => Wallet, (wallet) => wallet.transactions)
  @JoinColumn({ name: 'walletId' })
  wallet: Wallet;

  @Column()
  walletId: string;

  @OneToOne(() => BillPayment, (billPayment) => billPayment.transaction, {
    nullable: true,
  })
  billPayment: BillPayment;

  @CreateDateColumn()
  @ApiProperty({ description: 'Transaction creation timestamp' })
  createdAt: Date;

  @UpdateDateColumn()
  @ApiProperty({ description: 'Transaction last update timestamp' })
  updatedAt: Date;
}
