import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WalletsService } from './wallets.service';
import { Wallet } from './entities/wallet.entity';
import { TransactionsService } from '../transactions/transactions.service';
import { NotFoundException, ConflictException } from '@nestjs/common';

describe('WalletService', () => {
  let service: WalletsService;
  let walletRepository: Repository<Wallet>;
  let transactionsService: TransactionsService;

  const mockWalletRepository = {
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
  };

  const mockTransactionsService = {
    createTransaction: jest.fn(),
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WalletsService,
        {
          provide: getRepositoryToken(Wallet),
          useValue: mockWalletRepository,
        },
        {
          provide: TransactionsService,
          useValue: mockTransactionsService,
        },
      ],
    }).compile();

    service = module.get<WalletsService>(WalletsService);
    walletRepository = module.get<Repository<Wallet>>(getRepositoryToken(Wallet));
    transactionsService = module.get<TransactionsService>(TransactionsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findByUserId', () => {
    it('should return a wallet if found', async () => {
      const mockWallet = { id: 'wallet-id', userId: 'user-id', balance: 100 };
      mockWalletRepository.findOne.mockResolvedValue(mockWallet);

      const result = await service.findByUserId('user-id');

      expect(result).toEqual(mockWallet);
      expect(mockWalletRepository.findOne).toHaveBeenCalledWith({
        where: { userId: 'user-id' },
      });
    });

    it('should throw NotFoundException if wallet not found', async () => {
      mockWalletRepository.findOne.mockResolvedValue(null);

      await expect(service.findByUserId('nonexistent-user')).rejects.toThrow(NotFoundException);
    });
  });

  describe('createWallet', () => {
    it('should create a wallet if one does not exist', async () => {
      const mockWallet = { id: 'wallet-id', userId: 'user-id', balance: 0 };
      mockWalletRepository.findOne.mockResolvedValue(null);
      mockWalletRepository.create.mockReturnValue(mockWallet);
      mockWalletRepository.save.mockResolvedValue(mockWallet);

      const result = await service.createWallet('user-id');

      expect(result).toEqual(mockWallet);
      expect(mockWalletRepository.create).toHaveBeenCalledWith({ userId: 'user-id', balance: 0 });
      expect(mockWalletRepository.save).toHaveBeenCalledWith(mockWallet);
    });

    it('should throw ConflictException if wallet already exists', async () => {
      const mockWallet = { id: 'wallet-id', userId: 'user-id', balance: 0 };
      mockWalletRepository.findOne.mockResolvedValue(mockWallet);

      await expect(service.createWallet('user-id')).rejects.toThrow(ConflictException);
    });
  });

  describe('fundWallet', () => {
    it('should fund the wallet and create a transaction', async () => {
      const userId = 'user-id';
      const amount = 100;
      const mockWallet = { id: 'wallet-id', userId, balance: 50, version: 1 };
      const updatedWallet = { ...mockWallet, balance: 150, version: 2 };
      const mockTransaction = {
        id: 'transaction-id',
        type: TransactionType.DEPOSIT,
        status: TransactionStatus.COMPLETED,
        amount,
        userId,
      };

      mockWalletRepository.findOne.mockResolvedValue(mockWallet);
      mockWalletRepository.save.mockResolvedValue(updatedWallet);
      mockTransactionsService.createTransaction.mockResolvedValue(mockTransaction);

      const result = await service.fundWallet(userId, amount);

      expect(result).toEqual(mockTransaction);
      expect(mockWalletRepository.save).toHaveBeenCalledWith({
        ...mockWallet,
        balance: 150,
      });
      expect(mockTransactionsService.createTransaction).toHaveBeenCalledWith({
        userId,
        amount,
        type: TransactionType.DEPOSIT,
        status: TransactionStatus.COMPLETED,
      });
    });

    it('should throw NotFoundException if wallet not found', async () => {
      mockWalletRepository.findOne.mockResolvedValue(null);

      await expect(service.fundWallet('nonexistent-user', 100)).rejects.toThrow(NotFoundException);
    });
  });

  describe('deductAmount', () => {
    it('should deduct amount from wallet if sufficient balance', async () => {
      const userId = 'user-id';
      const amount = 50;
      const transactionId = 'transaction-id';
      const mockWallet = { id: 'wallet-id', userId, balance: 100, version: 1 };
      const updatedWallet = { ...mockWallet, balance: 50, version: 2 };

      mockWalletRepository.findOne.mockResolvedValue(mockWallet);
      mockWalletRepository.save.mockResolvedValue(updatedWallet);

      await service.deductAmount(userId, amount, transactionId);

      expect(mockWalletRepository.save).toHaveBeenCalledWith({
        ...mockWallet,
        balance: 50,
      });
    });

    it('should throw ConflictException if insufficient balance', async () => {
      const userId = 'user-id';
      const amount = 150;
      const transactionId = 'transaction-id';
      const mockWallet = { id: 'wallet-id', userId, balance: 100, version: 1 };

      mockWalletRepository.findOne.mockResolvedValue(mockWallet);

      await expect(service.deductAmount(userId, amount, transactionId)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('refundAmount', () => {
    it('should refund amount to wallet', async () => {
      const userId = 'user-id';
      const amount = 50;
      const transactionId = 'transaction-id';
      const mockWallet = { id: 'wallet-id', userId, balance: 100, version: 1 };
      const updatedWallet = { ...mockWallet, balance: 150, version: 2 };

      mockWalletRepository.findOne.mockResolvedValue(mockWallet);
      mockWalletRepository.save.mockResolvedValue(updatedWallet);

      await service.refundAmount(userId, amount, transactionId);

      expect(mockWalletRepository.save).toHaveBeenCalledWith({
        ...mockWallet,
        balance: 150,
      });
    });
  });
});