import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TransactionsService } from './transactions.service';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { TransactionQueueService } from '../queues/transaction.queue';
import { Transaction } from '../entities/transaction.entities';

describe('TransactionsService', () => {
  let service: TransactionsService;
  let queueService: TransactionQueueService;

  const mockTransactionRepository = {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    count: jest.fn(),
  };

  const mockQueueService = {
    addRollbackJob: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionsService,
        {
          provide: getRepositoryToken(Transaction),
          useValue: mockTransactionRepository,
        },
        {
          provide: TransactionQueueService,
          useValue: mockQueueService,
        },
      ],
    }).compile();

    service = module.get<TransactionsService>(TransactionsService);
    transactionRepository = module.get<Repository<Transaction>>(
      getRepositoryToken(Transaction),
    );
    queueService = module.get<TransactionQueueService>(TransactionQueueService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createTransaction', () => {
    it('should create and return a transaction', async () => {
      const transactionData = {
        userId: 'user-id',
        amount: 100,
        type: TransactionType.DEPOSIT,
        status: TransactionStatus.COMPLETED,
      };
      const mockTransaction = { id: 'transaction-id', ...transactionData };

      mockTransactionRepository.create.mockReturnValue(mockTransaction);
      mockTransactionRepository.save.mockResolvedValue(mockTransaction);

      const result = await service.createTransaction(transactionData);

      expect(result).toEqual(mockTransaction);
      expect(mockTransactionRepository.create).toHaveBeenCalledWith(
        transactionData,
      );
      expect(mockTransactionRepository.save).toHaveBeenCalledWith(
        mockTransaction,
      );
    });
  });

  describe('findOne', () => {
    it('should return a transaction if found', async () => {
      const mockTransaction = { id: 'transaction-id', userId: 'user-id' };
      mockTransactionRepository.findOne.mockResolvedValue(mockTransaction);

      const result = await service.findOne('transaction-id');

      expect(result).toEqual(mockTransaction);
      expect(mockTransactionRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'transaction-id' },
      });
    });

    it('should throw NotFoundException if transaction not found', async () => {
      mockTransactionRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne('nonexistent-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findOneForUser', () => {
    it('should return a transaction if found and belongs to user', async () => {
      const userId = 'user-id';
      const transactionId = 'transaction-id';
      const mockTransaction = { id: transactionId, userId };

      mockTransactionRepository.findOne.mockResolvedValue(mockTransaction);

      const result = await service.findOneForUser(transactionId, userId);

      expect(result).toEqual(mockTransaction);
      expect(mockTransactionRepository.findOne).toHaveBeenCalledWith({
        where: { id: transactionId },
      });
    });

    it('should throw ForbiddenException if transaction does not belong to user', async () => {
      const userId = 'user-id';
      const transactionId = 'transaction-id';
      const mockTransaction = { id: transactionId, userId: 'other-user-id' };

      mockTransactionRepository.findOne.mockResolvedValue(mockTransaction);

      await expect(
        service.findOneForUser(transactionId, userId),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('findAllByUserId', () => {
    it('should return paginated transactions for user', async () => {
      const userId = 'user-id';
      const pageOptionsDto = { page: 1, limit: 10, skip: 0 };
      const mockTransactions = [
        { id: 'transaction-id-1', userId },
        { id: 'transaction-id-2', userId },
      ];
      const totalCount = 2;

      mockTransactionRepository.find.mockResolvedValue(mockTransactions);
      mockTransactionRepository.count.mockResolvedValue(totalCount);

      const result = await service.findAllByUserId(userId, pageOptionsDto);

      expect(result.data).toEqual(mockTransactions);
      expect(result.meta.itemCount).toEqual(totalCount);
      expect(result.meta.page).toEqual(pageOptionsDto.page);
      expect(result.meta.limit).toEqual(pageOptionsDto.limit);
    });
  });

  describe('updateTransactionStatus', () => {
    it('should update transaction status', async () => {
      const transactionId = 'transaction-id';
      const status = TransactionStatus.COMPLETED;
      const failureReason = null;
      const mockTransaction = {
        id: transactionId,
        status: TransactionStatus.PENDING,
      };
      const updatedTransaction = { ...mockTransaction, status };

      mockTransactionRepository.findOne.mockResolvedValue(mockTransaction);
      mockTransactionRepository.save.mockResolvedValue(updatedTransaction);

      const result = await service.updateTransactionStatus(
        transactionId,
        status,
        failureReason,
      );

      expect(result).toEqual(updatedTransaction);
      expect(mockTransactionRepository.save).toHaveBeenCalledWith({
        ...mockTransaction,
        status,
        failureReason,
      });
    });
  });

  describe('createReversalTransaction', () => {
    it('should create a reversal transaction', async () => {
      const userId = 'user-id';
      const amount = 100;
      const originalTransactionId = 'original-transaction-id';
      const reason = 'Payment failed';
      const mockReversalTransaction = {
        id: 'reversal-transaction-id',
        userId,
        amount,
        type: TransactionType.REVERSAL,
        status: TransactionStatus.PENDING,
        referenceId: originalTransactionId,
      };

      mockTransactionRepository.create.mockReturnValue(mockReversalTransaction);
      mockTransactionRepository.save.mockResolvedValue(mockReversalTransaction);

      const result = await service.createReversalTransaction(
        userId,
        amount,
        originalTransactionId,
        reason,
      );

      expect(result).toEqual(mockReversalTransaction);
      expect(mockTransactionRepository.create).toHaveBeenCalledWith({
        userId,
        amount,
        type: TransactionType.REVERSAL,
        status: TransactionStatus.PENDING,
        referenceId: originalTransactionId,
        failureReason: reason,
      });
    });
  });

  describe('triggerRollback', () => {
    it('should trigger a rollback job', async () => {
      const transactionId = 'transaction-id';
      const userId = 'user-id';
      const amount = 100;
      const reason = 'Payment failed';

      await service.triggerRollback(transactionId, userId, amount, reason);

      expect(queueService.addRollbackJob).toHaveBeenCalledWith({
        transactionId,
        userId,
        amount,
        reason,
      });
    });
  });
});
