
import { Controller, Get } from '@nestjs/common';
import { BlockchainService } from './blockchain.service';

@Controller('v1/blockchain')
export class BlockchainController {
  constructor(
    private readonly blockchainService: BlockchainService,
  ) {}

  @Get('status')
  getStatus() {
    return this.blockchainService.getStatus();
  }
}
