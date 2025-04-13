// src/bill-payments/bill-payments.service.spec.ts
import { ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TransactionQueueService } from 'src/queue-processors/transaction.queue';
import {
  TransactionType,
  TransactionStatus,
} from 'src/transaction/entities/transaction.entities';
import { TransactionsService } from 'src/transaction/service/transaction.service';
import { WalletsService } from 'src/wallet/service/wallet.service';
import { Repository } from 'typeorm';
import { BillPayment, BillPaymentStatus } from '../entities/BillPayment.entity';
import { BillPaymentsService } from './bill-payment.service';

describe('BillPaymentsService', () => {
  let service: BillPaymentsService;
  let billPaymentRepository: Repository<BillPayment>;
  let walletsService: WalletsService;
  let transactionsService: TransactionsService;
  let queueService: TransactionQueueService;

  const mockBillPaymentRepository = {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockWalletsService = {
    deductAmount: jest.fn(),
  };

  const mockTransactionsService = {
    createTransaction: jest.fn(),
  };

  const mockQueueService = {
    addBillPaymentJob: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BillPaymentsService,
        {
          provide: getRepositoryToken(BillPayment),
          useValue: mockBillPaymentRepository,
        },
        {
          provide: WalletsService,
          useValue: mockWalletsService,
        },
        {
          provide: TransactionsService,
          useValue: mockTransactionsService,
        },
        {
          provide: TransactionQueueService,
          useValue: mockQueueService,
        },
      ],
    }).compile();

    service = module.get<BillPaymentsService>(BillPaymentsService);
    billPaymentRepository = module.get<Repository<BillPayment>>(
      getRepositoryToken(BillPayment),
    );
    walletsService = module.get<WalletsService>(WalletsService);
    transactionsService = module.get<TransactionsService>(TransactionsService);
    queueService = module.get<TransactionQueueService>(TransactionQueueService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a bill payment, deduct from wallet, and queue processing', async () => {
      const userId = 'user-id';
      const createBillPaymentDto = {
        amount: 100,
        billType: 'ELECTRICITY',
        meterNumber: '12345',
      };

      const mockTransaction = {
        id: 'transaction-id',
        userId,
        amount: createBillPaymentDto.amount,
        type: TransactionType.PAYMENT,
        status: TransactionStatus.PENDING,
      };

      const mockBillPayment = {
        id: 'bill-payment-id',
        ...createBillPaymentDto,
        userId,
        transactionId: mockTransaction.id,
        status: BillPaymentStatus.PENDING,
      };

      mockTransactionsService.createTransaction.mockResolvedValue(
        mockTransaction,
      );
      mockBillPaymentRepository.create.mockReturnValue(mockBillPayment);
      mockBillPaymentRepository.save.mockResolvedValue(mockBillPayment);

      const result = await service.create(userId, createBillPaymentDto);

      expect(result).toEqual(mockBillPayment);
      expect(mockWalletsService.deductAmount).toHaveBeenCalledWith(
        userId,
        createBillPaymentDto.amount,
        mockTransaction.id,
      );
      expect(mockTransactionsService.createTransaction).toHaveBeenCalledWith({
        userId,
        amount: createBillPaymentDto.amount,
        type: TransactionType.PAYMENT,
        status: TransactionStatus.PENDING,
      });
      expect(mockQueueService.addBillPaymentJob).toHaveBeenCalledWith({
        billPaymentId: mockBillPayment.id,
        transactionId: mockTransaction.id,
        userId,
        amount: createBillPaymentDto.amount,
      });
    });
  });

  describe('findOneForUser', () => {
    it('should return a bill payment if found and belongs to user', async () => {
      const userId = 'user-id';
      const billPaymentId = 'bill-payment-id';
      const mockBillPayment = { id: billPaymentId, userId };

      mockBillPaymentRepository.findOne.mockResolvedValue(mockBillPayment);

      const result = await service.findOneForUser(billPaymentId, userId);

      expect(result).toEqual(mockBillPayment);
      expect(mockBillPaymentRepository.findOne).toHaveBeenCalledWith({
        where: { id: billPaymentId },
      });
    });

    it('should throw ForbiddenException if bill payment does not belong to user', async () => {
      const userId = 'user-id';
      const billPaymentId = 'bill-payment-id';
      const mockBillPayment = { id: billPaymentId, userId: 'other-user-id' };

      mockBillPaymentRepository.findOne.mockResolvedValue(mockBillPayment);

      await expect(
        service.findOneForUser(billPaymentId, userId),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('findAllByUserId', () => {
    it('should return all bill payments for user', async () => {
      const userId = 'user-id';
      const mockBillPayments = [
        { id: 'bill-payment-id-1', userId },
        { id: 'bill-payment-id-2', userId },
      ];

      mockBillPaymentRepository.find.mockResolvedValue(mockBillPayments);

      const result = await service.findAllByUserId(userId);

      expect(result).toEqual(mockBillPayments);
      expect(mockBillPaymentRepository.find).toHaveBeenCalledWith({
        where: { userId },
        order: { createdAt: 'DESC' },
      });
    });
  });

  describe('markBillPaymentComplete', () => {
    it('should update bill payment status to complete', async () => {
      const billPaymentId = 'bill-payment-id';
      const mockBillPayment = {
        id: billPaymentId,
        status: BillPaymentStatus.PENDING,
      };
      const updatedBillPayment = {
        ...mockBillPayment,
        status: BillPaymentStatus.COMPLETED,
      };

      mockBillPaymentRepository.findOne.mockResolvedValue(mockBillPayment);
      mockBillPaymentRepository.save.mockResolvedValue(updatedBillPayment);

      const result = await service.markBillPaymentComplete(billPaymentId);

      expect(result).toEqual(updatedBillPayment);
      expect(mockBillPaymentRepository.save).toHaveBeenCalledWith({
        ...mockBillPayment,
        status: BillPaymentStatus.COMPLETED,
      });
    });
  });

  describe('markBillPaymentFailed', () => {
    it('should update bill payment status to failed with reason', async () => {
      const billPaymentId = 'bill-payment-id';
      const failureReason = 'Payment processing failed';
      const mockBillPayment = {
        id: billPaymentId,
        status: BillPaymentStatus.PENDING,
      };
      const updatedBillPayment = {
        ...mockBillPayment,
        status: BillPaymentStatus.FAILED,
        failureReason,
      };

      mockBillPaymentRepository.findOne.mockResolvedValue(mockBillPayment);
      mockBillPaymentRepository.save.mockResolvedValue(updatedBillPayment);

      const result = await service.markBillPaymentFailed(
        billPaymentId,
        failureReason,
      );

      expect(result).toEqual(updatedBillPayment);
      expect(mockBillPaymentRepository.save).toHaveBeenCalledWith({
        ...mockBillPayment,
        status: BillPaymentStatus.FAILED,
        failureReason,
      });
    });
  });
});
