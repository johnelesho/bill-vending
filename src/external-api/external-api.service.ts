import { Injectable, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { BillType } from '../bill-payments/entities/bill-payment.entity';

export interface BillPaymentRequest {
  billType: BillType;
  billReference: string;
  amount: number;
  customerName: string;
  transactionId: string;
  userId: string;
}

export interface BillPaymentResponse {
  success: boolean;
  reference?: string;
  token?: string;
  message?: string;
  error?: string;
}

@Injectable()
export class ExternalApiService {
  private readonly apiKey: string;
  private readonly apiUrl: string;
  
  constructor(
    private configService: ConfigService,
    @Inject(WINSTON_MODULE_PROVIDER)
    private readonly logger: Logger,
  ) {
    this.apiKey = this.configService.get<string>('EXTERNAL_API_KEY');
    this.apiUrl = this.configService.get<string>('EXTERNAL_API_URL');
  }

  async processBillPayment(payload: BillPaymentRequest): Promise<BillPaymentResponse> {
    try {
      this.logger.info('Processing bill payment through external API', {
        billType: payload.billType,
        billReference: payload.billReference,
        amount: payload.amount,
        transactionId: payload.transactionId,
      });
      
      // Mock API delay
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Simulate a random success/failure (80% success rate)
      const isSuccess = Math.random() < 0.8;
      
      if (isSuccess) {
        // Mock successful response
        const reference = `REF-${Date.now()}`;
        let token = null;
        
        // Generate token for prepaid services
        if (payload.billType === BillType.ELECTRICITY) {
          token = this.generateMockToken();
        }
        
        this.logger.info('Bill payment successful', {
          reference,
          token,
          transactionId: payload.transactionId,
        });
        
        return {
          success: true,
          reference,
          token,
          message: 'Payment processed successfully',
        };
      } else {
        // Mock error response
        const errorCode = Math.floor(Math.random() * 3) + 1;
        let errorMessage = 'Unknown error occurred';
        
        switch (errorCode) {
          case 1:
            errorMessage = 'Invalid bill reference';
            break;
          case 2:
            errorMessage = 'Service temporarily unavailable';
            break;
          case 3:
            errorMessage = 'Payment rejected by service provider';
            break;
        }
        
        this.logger.warn('Bill payment failed', {
          errorCode,
          errorMessage,
          transactionId: payload.transactionId,
        });
        
        return {
          success: false,
          error: errorMessage,
        };
      }
    } catch (error) {
      this.logger.error(`External API error: ${error.message}`, {
        stack: error.stack,
        payload,
      });
      
      return {
        success: false,
        error: 'Service unavailable',
      };
    }
  }

  private generateMockToken(): string {
    // Generate a random alphanumeric token for electricity
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let token = '';
    
    // Generate 4 groups of 4 characters
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        token += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      if (i < 3) token += '-';
    }
    
    return token;
  }

  async processBillPayment2(data: {
    userId: string;
    amount: number;
    billPaymentId: string;
    transactionId: string;
  }): Promise<{ success: boolean; message?: string; referenceNumber?: string }> {
    this.logger.log(`Processing external payment for bill payment ${data.billPaymentId}`);
    
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Simulate occasional failures (10% chance)
    const shouldFail = Math.random() < 0.1;
    
    if (shouldFail) {
      this.logger.warn(`External payment for bill payment ${data.billPaymentId} failed`);
      return {
        success: false,
        message: 'External service temporarily unavailable'
      };
    }
    
    // Generate a mock reference number
    const referenceNumber = `REF-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
    
    this.logger.log(`External payment for bill payment ${data.billPaymentId} succeeded with reference ${referenceNumber}`);
    
    return {
      success: true,
      referenceNumber
    };
  }
}