import {
  Body,
  BadRequestException,
  Controller,
  Post,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody, ApiResponse } from '@nestjs/swagger'; // <-- Import Swagger
import { z } from 'zod';
import { TransactionIntelligenceService } from './transaction-intelligence.service';

// Zod schema para sa validation
const intelligenceSchema = z.object({
  tokenAddress: z.string().regex(
    /^0x[a-fA-F0-9]{40}$/,
    'Invalid token contract address.',
  ),
  data: z.string().regex(
    /^0x([a-fA-F0-9]{2})+$/,
    'Invalid transaction calldata.',
  ),
});

@ApiTags('Intelligence')
@Controller('v1/intelligence')
export class TransactionIntelligenceController {
  constructor(
    private readonly intelligenceService: TransactionIntelligenceService,
  ) {}

  @Post('analyze')
  @ApiOperation({
    summary: 'Analyze a transaction calldata',
    description:
      'Decodes ERC20 and DEX swap calldata, checks spender risk via GoPlus, ' +
      'and scans the contract for dangerous functions (mint/selfdestruct).',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        tokenAddress: {
          type: 'string',
          example: '0x55d398326f99059fF775485246999027B3197955',
        },
        data: {
          type: 'string',
          example: '0xa9059cbb000000000000000000000000...',
        },
      },
      required: ['tokenAddress', 'data'],
    },
  })
  @ApiResponse({ status: 201, description: 'Analysis completed' })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  analyzeTransaction(@Body() body: unknown) {
    const parsed = intelligenceSchema.safeParse(body);

    if (!parsed.success) {
      throw new BadRequestException({
        message: 'Invalid transaction intelligence input.',
        issues: parsed.error.issues,
      });
    }

    return this.intelligenceService.analyzeTransaction(
      parsed.data.tokenAddress,
      parsed.data.data as `0x${string}`,
    );
  }
}