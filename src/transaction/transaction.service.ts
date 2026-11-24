
import { Injectable } from '@nestjs/common';
import { decodeFunctionData, isAddress, parseAbi } from 'viem';
import { TransactionInput } from './transaction.dto';
import { ThreatIntelligenceService } from '../threat-intelligence/threat-intelligence.service';

const erc20Abi = parseAbi([
  'function transfer(address to, uint256 amount)',
  'function approve(address spender, uint256 amount)',
  'function transferFrom(address from, address to, uint256 amount)',
]);

// Only use addresses from verified threat-intelligence sources.

type Severity = 'info' | 'low' | 'medium' | 'high' | 'critical';

type Finding = {
  type: string;
  severity: Severity;
  description: string;
};

@Injectable()
export class TransactionService {
  constructor(
  private readonly threatIntelligenceService: ThreatIntelligenceService,
) {}
  analyze(tx: TransactionInput) {
    const findings: Finding[] = [];
    let decoded: {
      functionName?: string;
      args?: readonly unknown[];
    } | null = null;

    let approvalDetails: {
      spender: string | null;
      amount: string;
      unlimited: boolean;
    } | null = null;

    const knownBadAddresses =
  this.threatIntelligenceService.getVerifiedThreatAddresses(tx.chainId);
const normalizedTo = tx.to.toLowerCase();

if (knownBadAddresses.has(normalizedTo)) {
      findings.push({
        type: 'KNOWN_MALICIOUS_RECIPIENT',
        severity: 'critical',
        description:
  'Recipient matches a verified threat-intelligence record for this blockchain network.',
      });
    }

    if (tx.data !== '0x') {
  if (tx.data.length < 10) {
    findings.push({
      type: 'UNRECOGNIZED_CALLDATA',
      severity: 'medium',
      description:
        'Call data is too short to contain a complete function selector.',
    });
  } else {
    try {
      const result = decodeFunctionData({
        abi: erc20Abi,
        data: tx.data as `0x${string}`,
      });

      decoded = {
        functionName: result.functionName,
        args: result.args as readonly unknown[],
      };
    } catch {
      findings.push({
        type: 'UNRECOGNIZED_CALLDATA',
        severity: 'medium',
        description:
          'Call data does not match the supported ERC-20 ABI. This is not proof of malicious behavior.',
      });
    }
  }
}

    const args = decoded?.args;

    if (decoded?.functionName === 'approve') {
      const spender =
        typeof args?.[0] === 'string' ? args[0] : null;

        if (spender && knownBadAddresses.has(spender.toLowerCase())) {
  findings.push({
    type: 'KNOWN_MALICIOUS_APPROVAL_SPENDER',
    severity: 'critical',
    description:
  'The approval spender matches a verified threat-intelligence record for this blockchain network. Independently review the evidence before signing.',
  });
}

      const amount =
        typeof args?.[1] === 'bigint' ? args[1] : null;

      const isMaxUint =
        amount !== null && amount === (2n ** 256n - 1n);

      const isZeroAmount = amount === 0n;

      approvalDetails = {
        spender,
        amount: amount?.toString() ?? 'unknown',
        unlimited: isMaxUint,
      };

      if (spender && !isAddress(spender)) {
        findings.push({
          type: 'INVALID_APPROVAL_SPENDER',
          severity: 'high',
          description: 'The decoded approval spender address is invalid.',
        });
      }

      if (isMaxUint) {
        findings.push({
          type: 'UNLIMITED_APPROVAL',
          severity: 'high',
          description:
            `Unlimited token approval requested for spender ${spender ?? 'unknown'}. The spender may be able to transfer the token balance allowed by the token contract.`,
        });
      } else if (isZeroAmount) {
        findings.push({
          type: 'ZERO_AMOUNT_APPROVAL',
          severity: 'info',
          description:
            'Approval amount is zero. This commonly revokes an existing token allowance.',
        });
      } else {
        findings.push({
          type: 'TOKEN_APPROVAL',
          severity: 'medium',
          description:
            `Token spending permission requested for spender ${spender ?? 'unknown'}, with allowance ${amount?.toString() ?? 'unknown'}. Verify the spender and amount.`,
        });
      }
    } else if (decoded?.functionName === 'transfer') {
      findings.push({
        type: 'ERC20_TRANSFER',
        severity: 'info',
        description:
          'ERC-20 transfer call decoded. Verify the token contract and recipient.',
      });
    } else if (decoded?.functionName === 'transferFrom') {
      findings.push({
        type: 'ERC20_TRANSFER_FROM',
        severity: 'medium',
        description:
          'ERC-20 transferFrom call detected. Verify the source, recipient, and token contract.',
      });
    } else if (tx.data === '0x') {
      findings.push({
        type: 'NATIVE_TRANSFER_OR_EMPTY_CALL',
        severity: 'info',
        description:
          'No contract calldata supplied. This may be a native-asset transfer or a contract call without data.',
      });
    }

    if (!isAddress(tx.from) || !isAddress(tx.to)) {
      findings.push({
        type: 'INVALID_ADDRESS',
        severity: 'high',
        description: 'One or more transaction addresses are invalid.',
      });
    }

    const riskScore = this.score(findings);

    const status =
      riskScore >= 70
        ? 'high_risk'
        : riskScore >= 35
          ? 'warning'
          : 'low_risk';

    return {
      engine: 'sentinelx-core',
      version: '0.2.0',
      chainId: tx.chainId,
      status,
      riskScore,
      decodedFunction: decoded?.functionName ?? null,
      approvalDetails,
      findings,
      limitations: [
        'Prototype rules only; no live threat-intelligence feed is connected.',
        'No RPC simulation or state-diff verification is performed.',
        'Only the listed ERC-20 functions are decoded.',
        'An unrecognized function is not automatically malicious.',
        'This result is informational and is not a guarantee of safety.',
      ],
      recommendation:
        status === 'high_risk'
          ? 'Stop and independently verify before signing.'
          : status === 'warning'
            ? 'Review the findings and verify the contract and permissions before signing.'
            : 'No high-risk pattern was identified by this prototype; continue to verify independently.',
    };
  }

    private score(findings: Finding[]): number {
    const weights: Record<Severity, number> = {
      info: 0,
      low: 10,
      medium: 35,
      high: 70,
      critical: 100,
    };

    // Count each finding type only once.
    const uniqueFindings = new Map<string, Finding>();

    for (const finding of findings) {
      const existing = uniqueFindings.get(finding.type);

      if (
        !existing ||
        weights[finding.severity] > weights[existing.severity]
      ) {
        uniqueFindings.set(finding.type, finding);
      }
    }

    // Critical findings immediately produce maximum risk.
    if (
      [...uniqueFindings.values()].some(
        (finding) => finding.severity === 'critical',
      )
    ) {
      return 100;
    }

    // Combine unique findings, capped at 100.
    const total = [...uniqueFindings.values()].reduce(
      (score, finding) => score + weights[finding.severity],
      0,
    );

    return Math.min(100, total);
  }
}
