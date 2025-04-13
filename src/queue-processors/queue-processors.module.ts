// src/queues/queues.module.ts
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TransactionQueueService } from './transaction.queue';
import { TransactionProcessor } from './processors/transaction.processor';
import { TransactionsModule } from '../transactions/transactions.module';
import { BillPaymentsModule } from '../bill-payments/bill-payments.module';
import { ExternalApiModule } from '../external-api/external-api.module';
import { WalletsModule } from '../wallets/wallets.module';

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        redis: {
          host: configService.get('REDIS_HOST', 'localhost'),
          port: configService.get<number>('REDIS_PORT', 6379),
        },
      }),
    }),
    BullModule.registerQueue({
      name: 'transactions',
    }),
    TransactionsModule,
    BillPaymentsModule,
    ExternalApiModule,
    WalletsModule,
  ],
  providers: [TransactionQueueService, TransactionProcessor],
  exports: [TransactionQueueService],
})
export class QueueProcessorModule {}