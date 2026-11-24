import { Body, Controller, Post, BadRequestException } from '@nestjs/common';
import { TransactionService } from './transaction.service';
import { transactionSchema } from './transaction.dto';

@Controller('v1/scan')
export class TransactionController {
  constructor(private readonly transactionService: TransactionService) {}

  @Post('transaction')
  scanTransaction(@Body() body: unknown) {
    const parsed = transactionSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        message: 'Invalid transaction input',
        issues: parsed.error.issues,
      });
    }
    return this.transactionService.analyze(parsed.data);
  }
}
