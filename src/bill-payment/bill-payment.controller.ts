// src/bill-payments/bill-payments.controller.ts
import {
  Controller,
  Post,
  Body,
  UseGuards,
  Request,
  Get,
  Param,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/user/auth/guards/jwt-auth.guard';
import { BillPaymentResponseDto } from './dto/bill-payment-response.dto';
import { CreateBillPaymentDto } from './dto/create-bill-payment.dto';
import { BillPaymentsService } from './service/bill-payment.service';


@ApiTags('bill-payments')
@Controller('bill-payments')
export class BillPaymentsController {
  constructor(private readonly billPaymentsService: BillPaymentsService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create bill payment' })
  @ApiResponse({
    status: 201,
    description: 'Bill payment initiated',
    type: BillPaymentResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async createBillPayment(
    @Request() req,
    @Body() createBillPaymentDto: CreateBillPaymentDto,
  ): Promise<BillPaymentResponseDto> {
    return this.billPaymentsService.create(req.user.id, createBillPaymentDto);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get bill payment by ID' })
  @ApiResponse({
    status: 200,
    description: 'Bill payment retrieved',
    type: BillPaymentResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Bill payment not found' })
  async getBillPayment(
    @Request() req,
    @Param('id') id: string,
  ): Promise<BillPaymentResponseDto> {
    return this.billPaymentsService.findOneForUser(id, req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get user bill payments' })
  @ApiResponse({
    status: 200,
    description: 'Bill payments retrieved',
    type: [BillPaymentResponseDto],
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getUserBillPayments(@Request() req): Promise<BillPaymentResponseDto[]> {
    return this.billPaymentsService.findAllByUserId(req.user.id);
  }
}
