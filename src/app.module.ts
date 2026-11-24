import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';

import { TransactionController } from './transaction/transaction.controller';
import { TransactionService } from './transaction/transaction.service';
import { BlockchainController } from './blockchain.controller';
import { SimulationController } from './simulation.controller';
import { BlockchainService } from './blockchain.service';
import { ThreatIntelligenceService } from './threat-intelligence/threat-intelligence.service';

import { Erc20Decoder } from './decoder/erc20-decoder';
import { DexDecoder } from './decoder/dex-decoder'; // <-- Import
import { TokenMetadataService } from './decoder/token-metadata.service';
import { TransactionIntelligenceService } from './decoder/transaction-intelligence.service';
import { TransactionIntelligenceController } from './decoder/transaction-intelligence.controller';
import { SpenderRiskService } from './decoder/spender-risk.service';
import { GoPlusAuthService } from './threat-intelligence/goplus-auth.service';
import { GoPlusAddressService } from './threat-intelligence/goplus-address.service';
import { GoPlusTestController } from './threat-intelligence/goplus-test.controller';
import { ContractScannerService } from './scanner/contract-scanner.service'; // <-- Import

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 60,
      },
    ]),
  ],
  controllers: [
    TransactionController,
    BlockchainController,
    SimulationController,
    TransactionIntelligenceController,
    GoPlusTestController,
  ],
  providers: [
    TransactionService,
    BlockchainService,
    ThreatIntelligenceService,
    GoPlusAuthService,
    GoPlusAddressService,
    Erc20Decoder,
    DexDecoder, // <-- SIGUROA NGA NA-ADD NI
    TokenMetadataService,
    TransactionIntelligenceService,
    SpenderRiskService,
    ContractScannerService, // <-- SIGUROA NGA NA-ADD NI
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}