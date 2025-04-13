import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { CreateBillPaymentDto } from '../dto/create-bill-payment.dto';
import {
  Transaction,
  TransactionStatus,
  TransactionType,
} from 'src/transaction/entities/transaction.entities';
import { WalletsService } from 'src/wallet/service/wallet.service';
import { BillPayment, BillPaymentStatus } from '../entities/BillPayment.entity';

@Injectable()
export class BillPaymentsService {
  constructor(
    @InjectRepository(BillPayment)
    private billPaymentsRepository: Repository<BillPayment>,
    @InjectRepository(Transaction)
    private transactionsRepository: Repository<Transaction>,
    private walletsService: WalletsService,
    private dataSource: DataSource,
    @InjectQueue('bill-payment')
    private billPaymentQueue: Queue,
    @Inject(WINSTON_MODULE_PROVIDER)
    private readonly logger: Logger,
  ) {}

  async create(
    userId: string,
    createBillPaymentDto: CreateBillPaymentDto,
  ): Promise<BillPayment> {
    const { billType, billReference, amount, customerName } =
      createBillPaymentDto;

    // Start a transaction
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Get wallet
      const wallet = await queryRunner.manager
        .createQueryBuilder()
        .select('wallet')
        .from('wallets', 'wallet')
        .innerJoin('wallet.user', 'user')
        .where('user.id = :userId', { userId })
        .getOne();

      if (!wallet) {
        throw new NotFoundException(`Wallet for user ${userId} not found`);
      }

      // Check if balance is sufficient
      if (Number(wallet.balance) < amount) {
        throw new BadRequestException('Insufficient wallet balance');
      }

      // Deduct amount from wallet
      const transaction = await this.walletsService.deductFromWallet(
        wallet.id,
        amount,
        TransactionType.BILL_PAYMENT,
        { billType, billReference, customerName },
        queryRunner.manager,
      );

      // Create bill payment record
      const billPayment = new BillPayment();
      billPayment.billType = billType;
      billPayment.billReference = billReference;
      billPayment.customerName = customerName;
      billPayment.status = BillPaymentStatus.PENDING;
      billPayment.transactionId = transaction.id;

      const savedBillPayment = await queryRunner.manager.save(billPayment);

      // Commit the transaction
      await queryRunner.commitTransaction();

      // Add to processing queue
      await this.billPaymentQueue.add(
        'process',
        {
          billPaymentId: savedBillPayment.id,
          transactionId: transaction.id,
        },
        {
          attempts: 3,
          backoff: 5000,
        },
      );

      this.logger.info(`Bill payment created and queued for processing`, {
        billPaymentId: savedBillPayment.id,
        transactionId: transaction.id,
        userId,
        billType,
        billReference,
        amount,
      });

      return savedBillPayment;
    } catch (error) {
      // Rollback on error
      await queryRunner.rollbackTransaction();

      this.logger.error(`Failed to create bill payment: ${error.message}`, {
        stack: error.stack,
        userId,
        billType,
        billReference,
        amount,
      });

      throw error;
    } finally {
      // Release query runner
      await queryRunner.release();
    }
  }

  async findAllByUserId(userId: string): Promise<BillPayment[]> {
    try {
      const billPayments = await this.billPaymentsRepository
        .createQueryBuilder('billPayment')
        .innerJoin('billPayment.transaction', 'transaction')
        .innerJoin('transaction.wallet', 'wallet')
        .innerJoin('wallet.user', 'user')
        .where('user.id = :userId', { userId })
        .orderBy('billPayment.createdAt', 'DESC')
        .getMany();

      return billPayments;
    } catch (error) {
      this.logger.error(
        `Failed to fetch bill payments by user ID: ${error.message}`,
        {
          stack: error.stack,
          userId,
        },
      );
      throw error;
    }
  }

  async findOne(id: string): Promise<BillPayment> {
    try {
      const billPayment = await this.billPaymentsRepository.findOne({
        where: { id },
        relations: ['transaction', 'transaction.wallet'],
      });

      if (!billPayment) {
        throw new NotFoundException(`Bill payment with ID ${id} not found`);
      }

      return billPayment;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      this.logger.error(`Failed to fetch bill payment: ${error.message}`, {
        stack: error.stack,
        billPaymentId: id,
      });
      throw error;
    }
  }

  async updateStatus(
    id: string,
    status: BillPaymentStatus,
    additionalData?: Record<string, any>,
  ): Promise<BillPayment> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const billPayment = await queryRunner.manager.findOne(BillPayment, {
        where: { id },
        relations: ['transaction'],
        lock: { mode: 'pessimistic_write' },
      });

      if (!billPayment) {
        throw new NotFoundException(`Bill payment with ID ${id} not found`);
      }

      // Update status
      billPayment.status = status;

      // Update additional data if provided
      if (additionalData) {
        billPayment.additionalData = {
          ...billPayment.additionalData,
          ...additionalData,
        };

        // Set external reference if available
        if (additionalData.reference) {
          billPayment.externalReference = additionalData.reference;
        }

        // Set token if available
        if (additionalData.token) {
          billPayment.token = additionalData.token;
        }
      }

      // If payment is completed, update transaction status
      if (status === BillPaymentStatus.COMPLETED) {
        const transaction = billPayment.transaction;
        transaction.status = TransactionStatus.COMPLETED;
        await queryRunner.manager.save(transaction);
      }

      const updatedBillPayment = await queryRunner.manager.save(billPayment);
      await queryRunner.commitTransaction();

      this.logger.info(`Bill payment status updated: ${id} -> ${status}`, {
        billPaymentId: id,
        transactionId: billPayment.transactionId,
        previousStatus: billPayment.status,
        newStatus: status,
      });

      return updatedBillPayment;
    } catch (error) {
      await queryRunner.rollbackTransaction();

      if (error instanceof NotFoundException) {
        throw error;
      }

      this.logger.error(
        `Failed to update bill payment status: ${error.message}`,
        {
          stack: error.stack,
          billPaymentId: id,
          status,
        },
      );
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
