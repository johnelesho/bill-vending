import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager, DataSource } from 'typeorm';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { Wallet } from '../entities/wallet.entity';
import { FundWalletDto } from '../dto/fund-wallet.dto';
import {
  Transaction,
  TransactionType,
  TransactionStatus,
} from 'src/transaction/entities/transaction.entities';

@Injectable()
export class WalletsService {
  constructor(
    @InjectRepository(Wallet)
    private walletsRepository: Repository<Wallet>,
    @InjectRepository(Transaction)
    private transactionsRepository: Repository<Transaction>,
    private dataSource: DataSource,
    @Inject(WINSTON_MODULE_PROVIDER)
    private readonly logger: Logger,
  ) {}

  async findByUserId(userId: string): Promise<Wallet> {
    try {
      const wallet = await this.walletsRepository.findOne({
        where: { userId },
      });

      if (!wallet) {
        throw new NotFoundException(`Wallet for user ${userId} not found`);
      }

      return wallet;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      this.logger.error(`Failed to fetch wallet: ${error.message}`, {
        stack: error.stack,
        userId,
      });
      throw error;
    }
  }

  async getBalance(userId: string): Promise<{ balance: number }> {
    const wallet = await this.findByUserId(userId);
    return { balance: Number(wallet.balance) };
  }

  async fundWallet(
    userId: string,
    fundWalletDto: FundWalletDto,
  ): Promise<Transaction> {
    const { amount } = fundWalletDto;

    if (amount <= 0) {
      throw new BadRequestException('Amount must be greater than zero');
    }

    // Start a transaction
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Get wallet with lock for update
      const wallet = await queryRunner.manager.findOne(Wallet, {
        where: { userId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!wallet) {
        throw new NotFoundException(`Wallet for user ${userId} not found`);
      }

      // Create transaction record
      const transaction = new Transaction();
      transaction.type = TransactionType.WALLET_FUNDING;
      transaction.amount = amount;
      transaction.status = TransactionStatus.COMPLETED; // For funding, we complete immediately
      transaction.walletId = wallet.id;
      transaction.metadata = {
        description: 'Wallet funding',
        previousBalance: wallet.balance,
      };

      // Update wallet balance
      wallet.balance = Number(wallet.balance) + Number(amount);

      // Save changes
      await queryRunner.manager.save(wallet);
      const savedTransaction = await queryRunner.manager.save(transaction);

      // Commit transaction
      await queryRunner.commitTransaction();

      this.logger.info(`Wallet funded for user ${userId}, amount: ${amount}`, {
        transactionId: savedTransaction.id,
        walletId: wallet.id,
        userId,
      });

      return savedTransaction;
    } catch (error) {
      // Rollback transaction on error
      await queryRunner.rollbackTransaction();

      this.logger.error(`Failed to fund wallet: ${error.message}`, {
        stack: error.stack,
        userId,
        amount,
      });

      throw error;
    } finally {
      // Release query runner
      await queryRunner.release();
    }
  }

  async deductFromWallet(
    walletId: string,
    amount: number,
    transactionType: TransactionType,
    metadata?: Record<string, any>,
    entityManager?: EntityManager,
  ): Promise<Transaction> {
    const manager = entityManager || this.dataSource.manager;

    // Get wallet with lock for update
    const wallet = await manager.findOne(Wallet, {
      where: { id: walletId },
      lock: { mode: 'pessimistic_write' },
    });

    if (!wallet) {
      throw new NotFoundException(`Wallet with ID ${walletId} not found`);
    }

    if (Number(wallet.balance) < amount) {
      throw new BadRequestException('Insufficient balance');
    }

    // Create pending transaction
    const transaction = new Transaction();
    transaction.type = transactionType;
    transaction.amount = amount;
    transaction.status = TransactionStatus.PENDING;
    transaction.walletId = wallet.id;
    transaction.metadata = {
      ...metadata,
      previousBalance: wallet.balance,
    };

    // Save transaction first
    const savedTransaction = await manager.save(transaction);

    // Update wallet balance
    wallet.balance = Number(wallet.balance) - amount;
    await manager.save(wallet);

    this.logger.info(
      `Amount deducted from wallet ID ${walletId}, amount: ${amount}`,
      {
        transactionId: savedTransaction.id,
        walletId,
        transactionType,
      },
    );

    return savedTransaction;
  }

  async refundToWallet(
    transactionId: string,
    entityManager?: EntityManager,
  ): Promise<Transaction> {
    const manager = entityManager || this.dataSource.manager;

    // Find the original transaction
    const originalTransaction = await manager.findOne(Transaction, {
      where: { id: transactionId },
      relations: ['wallet'],
    });

    if (!originalTransaction) {
      throw new NotFoundException(
        `Transaction with ID ${transactionId} not found`,
      );
    }

    if (originalTransaction.status === TransactionStatus.REVERSED) {
      throw new ConflictException('Transaction has already been reversed');
    }

    const wallet = await manager.findOne(Wallet, {
      where: { id: originalTransaction.walletId },
      lock: { mode: 'pessimistic_write' },
    });

    if (!wallet) {
      throw new NotFoundException(
        `Wallet not found for transaction ${transactionId}`,
      );
    }

    // Create refund transaction
    const refundTransaction = new Transaction();
    refundTransaction.type = TransactionType.REFUND;
    refundTransaction.amount = originalTransaction.amount;
    refundTransaction.status = TransactionStatus.COMPLETED;
    refundTransaction.walletId = wallet.id;
    refundTransaction.referenceTransactionId = transactionId;
    refundTransaction.metadata = {
      description: 'Refund for failed transaction',
      originalTransactionId: transactionId,
      previousBalance: wallet.balance,
    };

    // Update wallet balance
    wallet.balance =
      Number(wallet.balance) + Number(originalTransaction.amount);

    // Mark original transaction as reversed
    originalTransaction.status = TransactionStatus.REVERSED;

    // Save all changes
    await manager.save(wallet);
    await manager.save(originalTransaction);
    const savedRefundTransaction = await manager.save(refundTransaction);

    this.logger.info(`Refund processed for transaction ${transactionId}`, {
      refundTransactionId: savedRefundTransaction.id,
      originalTransactionId: transactionId,
      walletId: wallet.id,
      amount: originalTransaction.amount,
    });

    return savedRefundTransaction;
  }

  async getTransactionHistory(userId: string): Promise<Transaction[]> {
    try {
      const wallet = await this.findByUserId(userId);

      const transactions = await this.transactionsRepository.find({
        where: { walletId: wallet.id },
        order: { createdAt: 'DESC' },
      });

      return transactions;
    } catch (error) {
      this.logger.error(
        `Failed to fetch transaction history: ${error.message}`,
        {
          stack: error.stack,
          userId,
        },
      );
      throw error;
    }
  }
}
