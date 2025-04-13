import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { TransactionsService } from '../../transactions/transactions.service';
import { BillPaymentsService } from '../../bill-payments/bill-payments.service';
import { ExternalApiService } from '../../external-api/external-api.service';
import { WalletsService } from '../../wallets/wallets.service';
import {
  QueueJobs,
  BillPaymentJobData,
  RollbackTransactionJobData,
} from '../transaction.queue';
import { TransactionStatus } from '../../transactions/entities/transaction.entity';

@Processor('transactions')
export class TransactionProcessor {
  private readonly logger = new Logger(TransactionProcessor.name);

  constructor(
    private readonly transactionsService: TransactionsService,
    private readonly billPaymentsService: BillPaymentsService,
    private readonly externalApiService: ExternalApiService,
    private readonly walletsService: WalletsService,
  ) {}

  @Process(QueueJobs.PROCESS_BILL_PAYMENT)
  async processBillPayment(job: Job<BillPaymentJobData>): Promise<void> {
    const { billPaymentId, transactionId, userId, amount } = job.data;
    this.logger.log(
      `Processing bill payment ${billPaymentId} for transaction ${transactionId}`,
    );

    try {
      // Update transaction to processing
      await this.transactionsService.updateTransactionStatus(
        transactionId,
        TransactionStatus.PROCESSING,
      );

      // Call external API
      const paymentResult = await this.externalApiService.processBillPayment({
        userId,
        amount,
        billPaymentId,
        transactionId,
      });

      if (paymentResult.success) {
        // Update transaction to success
        await this.transactionsService.updateTransactionStatus(
          transactionId,
          TransactionStatus.COMPLETED,
        );

        // Update bill payment status
        await this.billPaymentsService.markBillPaymentComplete(billPaymentId);

        this.logger.log(`Successfully processed bill payment ${billPaymentId}`);
      } else {
        // Payment failed, trigger rollback
        this.logger.warn(
          `Bill payment ${billPaymentId} failed: ${paymentResult.message}`,
        );
        throw new Error(paymentResult.message || 'Payment processing failed');
      }
    } catch (error) {
      this.logger.error(
        `Error processing bill payment ${billPaymentId}: ${error.message}`,
        error.stack,
      );

      // Update transaction status to failed
      await this.transactionsService.updateTransactionStatus(
        transactionId,
        TransactionStatus.FAILED,
        error.message,
      );

      // Update bill payment status
      await this.billPaymentsService.markBillPaymentFailed(
        billPaymentId,
        error.message,
      );

      // Add rollback job to the queue
      await this.transactionsService.triggerRollback(
        transactionId,
        userId,
        amount,
        error.message,
      );

      // Re-throw error to mark the job as failed
      throw error;
    }
  }

  @Process(QueueJobs.ROLLBACK_TRANSACTION)
  async rollbackTransaction(
    job: Job<RollbackTransactionJobData>,
  ): Promise<void> {
    const { transactionId, userId, amount, reason } = job.data;
    this.logger.log(
      `Rolling back transaction ${transactionId} for user ${userId}`,
    );

    try {
      // Check if transaction is already rolled back
      const transaction = await this.transactionsService.findOne(transactionId);
      if (transaction.status === TransactionStatus.REVERSED) {
        this.logger.log(
          `Transaction ${transactionId} already reversed, skipping rollback`,
        );
        return;
      }

      // Create reversal transaction
      const reversalTransaction =
        await this.transactionsService.createReversalTransaction(
          userId,
          amount,
          transactionId,
          reason,
        );

      // Return funds to wallet
      await this.walletsService.refundAmount(
        userId,
        amount,
        reversalTransaction.id,
      );

      // Mark original transaction as reversed
      await this.transactionsService.updateTransactionStatus(
        transactionId,
        TransactionStatus.REVERSED,
        reason,
      );

      // Mark reversal transaction as completed
      await this.transactionsService.updateTransactionStatus(
        reversalTransaction.id,
        TransactionStatus.COMPLETED,
      );

      this.logger.log(`Successfully rolled back transaction ${transactionId}`);
    } catch (error) {
      this.logger.error(
        `Error rolling back transaction ${transactionId}: ${error.message}`,
        error.stack,
      );

      // Don't throw the error here to prevent the job from being retried indefinitely
      // Instead, we'll mark this job as failed but it will be completed
      // In a production system, you might want to alert about failed rollbacks
    }
  }
}
