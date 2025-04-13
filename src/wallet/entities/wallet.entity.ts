import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
  OneToMany,
  VersionColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Transaction } from 'src/transaction/entities/transaction.entities';
import { User } from 'src/user/entities/user.entity';

@Entity('wallets')
export class Wallet {
  @PrimaryGeneratedColumn('uuid')
  @ApiProperty({ description: 'Unique identifier for the wallet' })
  id: string;

  @Column({ type: 'decimal', precision: 20, scale: 2, default: 0 })
  @ApiProperty({ description: 'Wallet balance' })
  balance: number;

  @VersionColumn()
  version: number;

  @OneToOne(() => User, (user) => user.wallet)
  @JoinColumn()
  user: User;

  @Column()
  userId: string;

  @OneToMany(() => Transaction, (transaction) => transaction.wallet)
  transactions: Transaction[];

  @CreateDateColumn()
  @ApiProperty({ description: 'Wallet creation timestamp' })
  createdAt: Date;

  @UpdateDateColumn()
  @ApiProperty({ description: 'Wallet last update timestamp' })
  updatedAt: Date;
}
