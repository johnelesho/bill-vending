import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { Transaction, TransactionStatus } from './entities/transaction.entity';

@Injectable()
export class TransactionsService {
  constructor(
    @InjectRepository(Transaction)
    private transactionsRepository: Repository<Transaction>,
    private dataSource: DataSource,
    @Inject(WINSTON_MODULE_PROVIDER)
    private readonly logger: Logger,
  ) {}

  async findOne(id: string): Promise<Transaction> {
    try {
      const transaction = await this.transactionsRepository.findOne({
        where: { id },
        relations: ['wallet', 'billPayment'],
      });

      if (!transaction) {
        throw new NotFoundException(`Transaction with ID ${id} not found`);
      }

      return transaction;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      this.logger.error(`Failed to fetch transaction: ${error.message}`, {
        stack: error.stack,
        transactionId: id,
      });
      throw error;
    }
  }

  async findByUserId(userId: string): Promise<Transaction[]> {
    try {
      const transactions = await this.transactionsRepository
        .createQueryBuilder('transaction')
        .innerJoin('transaction.wallet', 'wallet')
        .innerJoin('wallet.user', 'user')
        .where('user.id = :userId', { userId })
        .orderBy('transaction.createdAt', 'DESC')
        .getMany();

      return transactions;
    } catch (error) {
      this.logger.error(
        `Failed to fetch transactions by user ID: ${error.message}`,
        {
          stack: error.stack,
          userId,
        },
      );
      throw error;
    }
  }

  async updateStatus(
    id: string,
    status: TransactionStatus,
  ): Promise<Transaction> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const transaction = await queryRunner.manager.findOne(Transaction, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });

      if (!transaction) {
        throw new NotFoundException(`Transaction with ID ${id} not found`);
      }

      transaction.status = status;
      const updatedTransaction = await queryRunner.manager.save(transaction);

      await queryRunner.commitTransaction();

      this.logger.info(`Transaction status updated: ${id} -> ${status}`, {
        transactionId: id,
        previousStatus: transaction.status,
        newStatus: status,
      });

      return updatedTransaction;
    } catch (error) {
      await queryRunner.rollbackTransaction();

      if (error instanceof NotFoundException) {
        throw error;
      }

      this.logger.error(
        `Failed to update transaction status: ${error.message}`,
        {
          stack: error.stack,
          transactionId: id,
          status,
        },
      );
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
