import {
  Body,
  Controller,
  Post,
  BadRequestException,
} from '@nestjs/common';

import { BlockchainService } from './blockchain.service';
import { transactionSchema } from './transaction/transaction.dto';

@Controller('v1/simulate')
export class SimulationController {
  constructor(
    private readonly blockchainService: BlockchainService,
  ) {}

  @Post('transaction')
  async simulateTransaction(@Body() body: unknown) {
    const parsed = transactionSchema.safeParse(body);

    if (!parsed.success) {
      throw new BadRequestException({
        message: 'Invalid transaction input',
        issues: parsed.error.issues,
      });
    }

    return this.blockchainService.simulateTransaction(
      parsed.data,
    );
  }
}