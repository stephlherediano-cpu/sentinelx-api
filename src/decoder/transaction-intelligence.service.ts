import { Injectable } from '@nestjs/common';
import type { Hex } from 'viem';

import { Erc20Decoder } from './erc20-decoder';
import { DexDecoder } from './dex-decoder';
import { TokenMetadataService } from './token-metadata.service';
import { SpenderRiskService } from './spender-risk.service';
import { ContractScannerService } from '../scanner/contract-scanner.service'; // <-- Import

export type TransactionAnalysisResult = {
  success: boolean;
  recognized: boolean;
  message?: string;
  transactionType?: 'SWAP' | 'TRANSFER' | 'APPROVE' | 'TRANSFER_FROM';
  protocol?: 'V2' | 'V3';
  transaction?: any;
  swapDetails?: any;
  approvalRisk?: any;
  spenderRisk?: any;
  contractScan?: any; // <-- Add
  riskAssessment?: {
    score: number;
    level: string;
    intelligenceStatus?: string;
    requiresReview: boolean;
    factors: string[];
    scoringVersion?: string;
  };
  token?: any;
  mode: string;
  limitations: string[];
};

@Injectable()
export class TransactionIntelligenceService {
  constructor(
    private readonly decoder: Erc20Decoder,
    private readonly dexDecoder: DexDecoder,
    private readonly metadataService: TokenMetadataService,
    private readonly spenderRiskService: SpenderRiskService,
    private readonly contractScannerService: ContractScannerService, // <-- Inject
  ) {}

  async analyzeTransaction(
    tokenAddress: string,
    data: Hex,
  ): Promise<TransactionAnalysisResult> {
    // Step 0: Scan the token contract for dangerous functions
    const contractScan = await this.contractScannerService.scanContract(tokenAddress);

    // Step 1: Try DEX Swap decoding
    const dexDecoded = this.dexDecoder.decode(data);

    if (dexDecoded.recognized) {
      const swapResult = this.analyzeSwap(dexDecoded);
      
      // Add contract scan risk to swap analysis
if (contractScan.success && contractScan.riskScore && contractScan.riskScore >= 50) {
  if (swapResult.riskAssessment) { // <-- Check if exists
    swapResult.riskAssessment.score += 50;
    swapResult.riskAssessment.level = 'HIGH';
    swapResult.riskAssessment.requiresReview = true;
    swapResult.riskAssessment.factors.push('Contract contains dangerous functions: +50');
  }
}
      
      swapResult.contractScan = contractScan; // <-- Attach scan result
      return swapResult;
    }

    // Step 1: Fallback to ERC20 Decoding
    const decoded = this.decoder.decode(data);

    if (!decoded.recognized) {
      return {
        success: false,
        recognized: false,
        message: decoded.message,
        mode: 'read-only',
        limitations: ['Decoded calldata does not prove that a transaction is safe.'],
      };
    }

    // Step 2: Retrieve token metadata
    const metadata =
      await this.metadataService.getTokenMetadata(tokenAddress);

    // Step 3: Validate decoded amount
    if (
      !('rawAmount' in decoded) ||
      typeof decoded.rawAmount !== 'string'
    ) {
      return {
        success: false,
        recognized: false,
        message: 'Decoded transaction amount is missing or invalid.',
        mode: 'read-only',
        limitations: [],
      };
    }

    const rawAmount = BigInt(decoded.rawAmount);

    const formattedAmount =
      'unlimitedApproval' in decoded && decoded.unlimitedApproval
        ? 'UNLIMITED'
        : this.formatAmount(rawAmount, metadata.decimals);

    // Step 4: Assess approval risk
    let approvalRisk = null;

    if ('unlimitedApproval' in decoded) {
      approvalRisk = decoded.unlimitedApproval
        ? {
            level: 'HIGH',
            code: 'UNLIMITED_APPROVAL',
            warning:
              'Unlimited token approval detected. The spender may be authorized to spend the full token balance.',
            requiresReview: true,
          }
        : {
            level: 'REVIEW',
            code: 'LIMITED_APPROVAL',
            warning:
              'Token spending permission detected. Review the spender and approved amount before signing.',
            requiresReview: true,
          };
    }

    // Step 5: Assess spender risk
    let spenderRisk = null;

    if (
      'spender' in decoded &&
      typeof decoded.spender === 'string'
    ) {
      spenderRisk =
        await this.spenderRiskService.analyzeSpender(
          decoded.spender,
        );
    }

    // Step 6: Calculate combined risk score
    let riskScore = 0;
    const riskFactors: string[] = [];
    let intelligenceStatus: 'AVAILABLE' | 'PARTIAL' = 'AVAILABLE';

    if (approvalRisk?.code === 'UNLIMITED_APPROVAL') {
      riskScore += 40;
      riskFactors.push('Unlimited token approval: +40');
    } else if (approvalRisk?.code === 'LIMITED_APPROVAL') {
      riskScore += 15;
      riskFactors.push('Limited token approval: +15');
    }

    if (spenderRisk?.level === 'HIGH') {
      riskScore += 50;
      riskFactors.push('GoPlus threat indicator detected: +50');
    } else if (spenderRisk?.level === 'UNKNOWN') {
      intelligenceStatus = 'PARTIAL';
      riskFactors.push(
        'GoPlus check unavailable: spender risk remains unknown',
      );
    }

    riskScore = Math.min(riskScore, 100);

    let riskLevel: string;

    if (riskScore >= 80) {
      riskLevel = 'CRITICAL';
    } else if (riskScore >= 50) {
      riskLevel = 'HIGH';
    } else if (riskScore >= 20) {
      riskLevel = 'REVIEW';
    } else {
      riskLevel = 'LOW';
    }

    // Step 7: Return ERC20 transaction intelligence
    return {
      success: true,
      recognized: true,
      transaction: {
        ...decoded,
        formattedAmount,
      },
      approvalRisk,
      spenderRisk,
      contractScan,
      riskAssessment: {
        score: riskScore,
        level: riskLevel,
        intelligenceStatus,
        requiresReview:
          approvalRisk?.requiresReview === true ||
          spenderRisk?.requiresReview === true ||
          riskScore >= 20 ||
          intelligenceStatus === 'PARTIAL',
        factors: riskFactors,
        scoringVersion: '0.1',
      },
      token: {
        address: metadata.token,
        name: metadata.name,
        symbol: metadata.symbol,
        decimals: metadata.decimals,
      },
      mode: 'read-only',
      limitations: [
        'Risk scoring is an experimental rules-based assessment.',
        'Risk scores are not proof that a transaction is safe or malicious.',
        'GoPlus threat indicators do not guarantee that an address is malicious.',
        'An UNKNOWN spender result means threat intelligence could not be retrieved.',
        'Token metadata is not independently verified.',
        'Decoded calldata does not prove that a transaction is safe.',
      ],
    };
  }

  // <-- 4. Ang bag-ong analyzeSwap method
  private analyzeSwap(dexDecoded: any): TransactionAnalysisResult {
    const riskFactors: string[] = [];
    let riskScore = 0;

    if (dexDecoded.slippageRisk === 'HIGH') {
      riskScore += 50;
      riskFactors.push('High slippage risk: amountOutMin is set to 0. Vulnerable to front-running.');
    }

    return {
      success: true,
      recognized: true,
      transactionType: 'SWAP',
      protocol: dexDecoded.protocol,
      swapDetails: {
        tokenIn: dexDecoded.tokenIn,
        tokenOut: dexDecoded.tokenOut,
        amountIn: dexDecoded.amountIn,
        amountOutMin: dexDecoded.amountOutMin,
        recipient: dexDecoded.recipient,
      },
      riskAssessment: {
        score: riskScore,
        level: riskScore >= 50 ? 'HIGH' : 'LOW',
        requiresReview: riskScore >= 50,
        factors: riskFactors,
        scoringVersion: '0.1',
      },
      mode: 'read-only',
      limitations: [
        'Swap decoding is based on standard PancakeSwap/Uniswap ABIs.',
        'Does not simulate the actual swap output.',
      ],
    };
  }

  private formatAmount(amount: bigint, decimals: number) {
    const divisor = 10n ** BigInt(decimals);
    const whole = amount / divisor;
    const fraction = amount % divisor;

    if (decimals === 0 || fraction === 0n) {
      return whole.toString();
    }

    const formattedFraction = fraction
      .toString()
      .padStart(decimals, '0')
      .replace(/0+$/, '');

    return `${whole}.${formattedFraction}`;
  }
}