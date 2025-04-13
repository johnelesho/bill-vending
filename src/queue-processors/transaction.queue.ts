import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { Logger } from '@nestjs/common';

export enum QueueJobs {
  PROCESS_BILL_PAYMENT = 'process-bill-payment',
  ROLLBACK_TRANSACTION = 'rollback-transaction',
}

export interface BillPaymentJobData {
  billPaymentId: string;
  transactionId: string;
  userId: string;
  amount: number;
}

export interface RollbackTransactionJobData {
  transactionId: string;
  userId: string;
  amount: number;
  reason: string;
}

@Injectable()
export class TransactionQueueService {
  private readonly logger = new Logger(TransactionQueueService.name);

  constructor(
    @InjectQueue('transactions') private transactionsQueue: Queue,
  ) {}

  async addBillPaymentJob(data: BillPaymentJobData): Promise<void> {
    try {
      await this.transactionsQueue.add(QueueJobs.PROCESS_BILL_PAYMENT, data, {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000, // 5 seconds initial delay
        },
        removeOnComplete: true,
        removeOnFail: false,
      });
      this.logger.log(`Added bill payment job for transaction ${data.transactionId}`);
    } catch (error) {
      this.logger.error(`Failed to add bill payment job: ${error.message}`, error.stack);
      throw error;
    }
  }

  async addRollbackJob(data: RollbackTransactionJobData): Promise<void> {
    try {
      await this.transactionsQueue.add(QueueJobs.ROLLBACK_TRANSACTION, data, {
        attempts: 5, // More attempts for rollbacks since they're critical
        backoff: {
          type: 'exponential',
          delay: 3000,
        },
        removeOnComplete: true,
        removeOnFail: false,
      });
      this.logger.log(`Added rollback job for transaction ${data.transactionId}`);
    } catch (error) {
      this.logger.error(`Failed to add rollback job: ${error.message}`, error.stack);
      throw error;
    }
  }
}