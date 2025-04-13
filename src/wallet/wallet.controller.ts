import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { TransactionResponseDto } from 'src/transaction/dto/transaction-response.dto';
import { JwtAuthGuard } from 'src/user/auth/guards/jwt-auth.guard';
import { FundWalletDto } from './dto/fund-wallet.dto';
import { WalletResponseDto } from './dto/wallet-response.dto';
import { WalletsService } from './service/wallet.service';

@ApiTags('wallets')
@Controller('wallets')
export class WalletsController {
  constructor(private readonly walletsService: WalletsService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get user wallet balance' })
  @ApiResponse({
    status: 200,
    description: 'Wallet retrieved',
    type: WalletResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getWallet(@Request() req): Promise<WalletResponseDto> {
    const wallet = await this.walletsService.findByUserId(req.user.id);
    return {
      id: wallet.id,
      balance: wallet.balance,
      userId: wallet.userId,
      createdAt: wallet.createdAt,
      updatedAt: wallet.updatedAt,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Post('fund')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Fund user wallet' })
  @ApiResponse({
    status: 201,
    description: 'Wallet funded',
    type: TransactionResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async fundWallet(
    @Request() req,
    @Body() fundWalletDto: FundWalletDto,
  ): Promise<TransactionResponseDto> {
    return this.walletsService.fundWallet(req.user.id, fundWalletDto);
  }
}
