
import { encodeFunctionData, parseAbi } from 'viem';
import { TransactionService } from './transaction.service';
import { beforeEach, describe, expect, it } from 'vitest';
import type { ThreatIntelligenceService } from '../threat-intelligence/threat-intelligence.service';

const abi = parseAbi([
  'function approve(address spender, uint256 amount)',
  'function transfer(address to, uint256 amount)',
]);

type TestFinding = {
  type: string;
  severity: 'info' | 'low' | 'medium' | 'high' | 'critical';
  description: string;
};

describe('SentinelX TransactionService v0.2', () => {
  const threatAddresses = new Map<number, Set<string>>();

  const threatIntelligenceService = {
    getVerifiedThreatAddresses: (chainId: number) =>
      threatAddresses.get(chainId) ?? new Set<string>(),
  };

  const service = new TransactionService(
    threatIntelligenceService as ThreatIntelligenceService,
  );

  beforeEach(() => {
    threatAddresses.clear();
  });

  const spender = '0x3333333333333333333333333333333333333333';

  const base = {
    chainId: 56,
    from: '0x1111111111111111111111111111111111111111',
    to: '0x2222222222222222222222222222222222222222',
    value: '0',
  };

    const calculateRiskScore = (findings: TestFinding[]): number => {
    const score = Reflect.get(service, 'score');

    if (typeof score !== 'function') {
      throw new Error('Risk scoring function not found');
    }

    return score.call(service, findings);
  };

  it('combines two unique medium findings into a score of 70', () => {
    const result = calculateRiskScore([
      {
        type: 'TOKEN_APPROVAL',
        severity: 'medium',
        description: 'Test approval',
      },
      {
        type: 'ERC20_TRANSFER_FROM',
        severity: 'medium',
        description: 'Test transferFrom',
      },
    ]);

    expect(result).toBe(70);
  });

  it('does not double count duplicate finding types', () => {
    const result = calculateRiskScore([
      {
        type: 'TOKEN_APPROVAL',
        severity: 'medium',
        description: 'First finding',
      },
      {
        type: 'TOKEN_APPROVAL',
        severity: 'medium',
        description: 'Duplicate finding',
      },
    ]);

    expect(result).toBe(35);
  });

  it('assigns maximum score to critical findings', () => {
    const result = calculateRiskScore([
      {
        type: 'KNOWN_MALICIOUS_RECIPIENT',
        severity: 'critical',
        description: 'Critical test finding',
      },
    ]);

    expect(result).toBe(100);
  });

  it('caps cumulative risk score at 100', () => {
    const result = calculateRiskScore([
      {
        type: 'TEST_HIGH_ONE',
        severity: 'high',
        description: 'High finding one',
      },
      {
        type: 'TEST_HIGH_TWO',
        severity: 'high',
        description: 'High finding two',
      },
    ]);

    expect(result).toBe(100);
  });

  it('detects unlimited ERC-20 approval as high risk', () => {
    const data = encodeFunctionData({
      abi,
      functionName: 'approve',
      args: [spender, 2n ** 256n - 1n],
    });

    const result = service.analyze({ ...base, data });

    expect(result.status).toBe('high_risk');
    expect(result.findings.some(
      (f) => f.type === 'UNLIMITED_APPROVAL',
    )).toBe(true);
    expect(result.approvalDetails?.unlimited).toBe(true);
  });

  it('detects normal token approval as medium risk', () => {
    const data = encodeFunctionData({
      abi,
      functionName: 'approve',
      args: [spender, 1000n],
    });

    const result = service.analyze({ ...base, data });

    expect(result.status).toBe('warning');
    expect(result.findings.some(
      (f) => f.type === 'TOKEN_APPROVAL',
    )).toBe(true);
    expect(result.approvalDetails?.amount).toBe('1000');
  });

  it('identifies the correct approval spender', () => {
    const data = encodeFunctionData({
      abi,
      functionName: 'approve',
      args: [spender, 5000n],
    });

    const result = service.analyze({ ...base, data });

    expect(result.approvalDetails?.spender).toBe(spender);
  });

  it('identifies zero approval as informational', () => {
    const data = encodeFunctionData({
      abi,
      functionName: 'approve',
      args: [spender, 0n],
    });

    const result = service.analyze({ ...base, data });

    expect(result.status).toBe('low_risk');
    expect(result.findings.some(
      (f) => f.type === 'ZERO_AMOUNT_APPROVAL',
    )).toBe(true);
  });

  it('decodes ERC-20 transfer', () => {
    const data = encodeFunctionData({
      abi,
      functionName: 'transfer',
      args: [spender, 100n],
    });

    const result = service.analyze({ ...base, data });

    expect(result.decodedFunction).toBe('transfer');
    expect(result.findings.some(
      (f) => f.type === 'ERC20_TRANSFER',
    )).toBe(true);
  });

  it('reports empty calldata as informational', () => {
    const result = service.analyze({ ...base, data: '0x' });

    expect(result.status).toBe('low_risk');
    expect(result.limitations.length).toBeGreaterThan(0);
  });

  it('flags unrecognized calldata for review', () => {
    const result = service.analyze({
      ...base,
      data: '0x12345678',
    });

    expect(result.findings.some(
      (f) => f.type === 'UNRECOGNIZED_CALLDATA',
    )).toBe(true);
    expect(result.status).toBe('warning');
  });

    it('flags calldata shorter than a function selector', () => {
    const result = service.analyze({
      ...base,
      data: '0x12',
    });

    expect(result.status).toBe('warning');
    expect(result.riskScore).toBe(35);
    expect(result.findings.some(
      (f) => f.type === 'UNRECOGNIZED_CALLDATA',
    )).toBe(true);
  });

  it('flags a verified malicious recipient', () => {
  threatAddresses.set(56, new Set([base.to.toLowerCase()]));

  const result = service.analyze({
    ...base,
    data: '0x',
  });

  expect(result.status).toBe('high_risk');
  expect(result.riskScore).toBe(100);
  expect(result.findings.some(
    (f) => f.type === 'KNOWN_MALICIOUS_RECIPIENT',
  )).toBe(true);
});

  it('does not flag a BNB threat address on Ethereum', () => {
  threatAddresses.set(56, new Set([base.to.toLowerCase()]));

  const result = service.analyze({
    ...base,
    chainId: 1,
    data: '0x',
  });

  expect(
    result.findings.some(
      (f) => f.type === 'KNOWN_MALICIOUS_RECIPIENT',
    ),
  ).toBe(false);

  expect(result.status).toBe('low_risk');
});

 it('flags a verified malicious approval spender', () => {
  threatAddresses.set(56, new Set([spender.toLowerCase()]));

  const data = encodeFunctionData({
    abi,
    functionName: 'approve',
    args: [spender, 1000n],
  });

  const result = service.analyze({ ...base, data });

  expect(result.status).toBe('high_risk');
  expect(result.riskScore).toBe(100);
  expect(result.findings.some(
    (f) => f.type === 'KNOWN_MALICIOUS_APPROVAL_SPENDER',
  )).toBe(true);
});

  it('returns the SentinelX v0.2 engine version', () => {
    const result = service.analyze({ ...base, data: '0x' });

    expect(result.engine).toBe('sentinelx-core');
    expect(result.version).toBe('0.2.0');
  });


});
