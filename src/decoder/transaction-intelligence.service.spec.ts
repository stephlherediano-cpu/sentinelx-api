import { describe, it, expect, vi } from 'vitest';
import type { Hex } from 'viem';

import { TransactionIntelligenceService } from './transaction-intelligence.service';
import { Erc20Decoder } from './erc20-decoder';
import { DexDecoder } from './dex-decoder';
import { TokenMetadataService } from './token-metadata.service';
import { SpenderRiskService } from './spender-risk.service';
import { ContractScannerService } from '../scanner/contract-scanner.service'; // <-- Import

describe('TransactionIntelligenceService', () => {
  const tokenAddress = '0x1111111111111111111111111111111111111111';
  const data = '0xa9059cbb' as Hex;

  // Helper function para dali ra mag-create og service with mocks
  const createService = (overrides: {
    decoderMock?: any;
    dexDecoderMock?: any;
    metadataMock?: any;
    spenderMock?: any;
    scannerMock?: any; // <-- Add scanner
  } = {}) => {
    const decoder = overrides.decoderMock ?? { decode: vi.fn() };
    const dexDecoder = overrides.dexDecoderMock ?? { decode: vi.fn().mockReturnValue({ recognized: false }) };
    const metadata = overrides.metadataMock ?? { getTokenMetadata: vi.fn() };
    const spender = overrides.spenderMock ?? { analyzeSpender: vi.fn() };
    const scanner = overrides.scannerMock ?? { scanContract: vi.fn().mockResolvedValue({ success: true, isContract: false, riskScore: 0 }) }; // <-- Default mock

    return new TransactionIntelligenceService(
      decoder as Erc20Decoder,
      dexDecoder as DexDecoder,
      metadata as TokenMetadataService,
      spender as SpenderRiskService,
      scanner as ContractScannerService, // <-- Inject
    );
  };

  // --- EXISTING TESTS ---

  it('should analyze a recognized transaction', async () => {
    const decoderMock = {
      decode: vi.fn().mockReturnValue({
        recognized: true,
        type: 'TRANSFER',
        recipient: '0x2222222222222222222222222222222222222222',
        rawAmount: '1000000',
        formattedAmount: '0.000000000001',
      }),
    };
    const metadataMock = {
      getTokenMetadata: vi.fn().mockResolvedValue({
        token: tokenAddress,
        name: 'Test Token',
        symbol: 'TEST',
        decimals: 6,
      }),
    };

    const service = createService({ decoderMock, metadataMock });
    const result = await service.analyzeTransaction(tokenAddress, data);

    expect(result.success).toBe(true);
    expect(result.recognized).toBe(true);
    if (result.success) {
      expect(result.transaction?.formattedAmount).toBe('1');
      expect(result.token?.symbol).toBe('TEST');
    }
  });

  it('should reject unrecognized transaction data', async () => {
    const decoderMock = {
      decode: vi.fn().mockReturnValue({
        recognized: false,
        type: 'UNKNOWN',
        message: 'Unable to decode transaction calldata.',
      }),
    };
    const metadataMock = { getTokenMetadata: vi.fn() };

    const service = createService({ decoderMock, metadataMock });
    const result = await service.analyzeTransaction(tokenAddress, data);

    expect(result.success).toBe(false);
    expect(result.recognized).toBe(false);
    expect(metadataMock.getTokenMetadata).not.toHaveBeenCalled();
  });

  it('should detect unlimited token approval as HIGH risk', async () => {
    const decoderMock = {
      decode: vi.fn().mockReturnValue({
        recognized: true,
        type: 'APPROVE',
        spender: '0x3333333333333333333333333333333333333333',
        rawAmount: '115792089237316195423570985008687907853269984665640564039457584007913129639935',
        formattedAmount: 'unlimited',
        unlimitedApproval: true,
      }),
    };
    const metadataMock = {
      getTokenMetadata: vi.fn().mockResolvedValue({
        token: tokenAddress,
        name: 'Test Token',
        symbol: 'TEST',
        decimals: 18,
      }),
    };

    const service = createService({ decoderMock, metadataMock });
    const result = await service.analyzeTransaction(tokenAddress, data);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.approvalRisk?.level).toBe('HIGH');
      expect(result.approvalRisk?.code).toBe('UNLIMITED_APPROVAL');
      expect(result.approvalRisk?.requiresReview).toBe(true);
    }
  });

  it('should detect limited token approval as REVIEW risk', async () => {
    const decoderMock = {
      decode: vi.fn().mockReturnValue({
        recognized: true,
        type: 'APPROVE',
        spender: '0x3333333333333333333333333333333333333333',
        rawAmount: '5000000',
        formattedAmount: '0.000000000005',
        unlimitedApproval: false,
      }),
    };
    const metadataMock = {
      getTokenMetadata: vi.fn().mockResolvedValue({
        token: tokenAddress,
        name: 'Test Token',
        symbol: 'TEST',
        decimals: 18,
      }),
    };

    const service = createService({ decoderMock, metadataMock });
    const result = await service.analyzeTransaction(tokenAddress, data);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.approvalRisk?.level).toBe('REVIEW');
      expect(result.approvalRisk?.code).toBe('LIMITED_APPROVAL');
      expect(result.approvalRisk?.requiresReview).toBe(true);
    }
  });

  // --- NEW TESTS FOR SWAP ---

  it('should analyze a swap transaction as HIGH risk if slippage is 0', async () => {
    const dexDecoderMock = {
      decode: vi.fn().mockReturnValue({
        recognized: true,
        type: 'DEX_SWAP_V2',
        protocol: 'V2',
        amountIn: '1000',
        amountOutMin: '0',
        tokenIn: '0x1111111111111111111111111111111111111111',
        tokenOut: '0x2222222222222222222222222222222222222222',
        recipient: '0x3333333333333333333333333333333333333333',
        slippageRisk: 'HIGH',
      }),
    };

    const service = createService({ dexDecoderMock });
    const result = await service.analyzeTransaction(tokenAddress, data);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.transactionType).toBe('SWAP');
      expect(result.riskAssessment?.level).toBe('HIGH');
      expect(result.riskAssessment?.score).toBe(50);
    }
  });

  it('should analyze a swap transaction as LOW risk if slippage is NORMAL', async () => {
    const dexDecoderMock = {
      decode: vi.fn().mockReturnValue({
        recognized: true,
        type: 'DEX_SWAP_V2',
        protocol: 'V2',
        amountIn: '1000',
        amountOutMin: '900',
        tokenIn: '0x1111111111111111111111111111111111111111',
        tokenOut: '0x2222222222222222222222222222222222222222',
        recipient: '0x3333333333333333333333333333333333333333',
        slippageRisk: 'NORMAL',
      }),
    };

    const service = createService({ dexDecoderMock });
    const result = await service.analyzeTransaction(tokenAddress, data);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.transactionType).toBe('SWAP');
      expect(result.riskAssessment?.level).toBe('LOW');
      expect(result.riskAssessment?.score).toBe(0);
    }
  });

  // --- NEW TEST FOR CONTRACT SCAN ---

  it('should flag HIGH risk swap if contract has dangerous functions', async () => {
    const dexDecoderMock = {
      decode: vi.fn().mockReturnValue({
        recognized: true,
        type: 'DEX_SWAP_V2',
        protocol: 'V2',
        amountIn: '1000',
        amountOutMin: '900',
        tokenIn: '0x1111111111111111111111111111111111111111',
        tokenOut: '0x2222222222222222222222222222222222222222',
        recipient: '0x3333333333333333333333333333333333333333',
        slippageRisk: 'NORMAL',
      }),
    };
    
    const scannerMock = {
      scanContract: vi.fn().mockResolvedValue({
        success: true,
        isContract: true,
        riskScore: 50, // Contains dangerous function
        riskLevel: 'HIGH',
      }),
    };

    const service = createService({ dexDecoderMock, scannerMock });
    const result = await service.analyzeTransaction(tokenAddress, data);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.riskAssessment?.level).toBe('HIGH');
      expect(result.riskAssessment?.requiresReview).toBe(true);
      expect(result.contractScan).toBeDefined();
    }
  });
});