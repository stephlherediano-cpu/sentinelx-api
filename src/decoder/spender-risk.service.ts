
import { Injectable } from '@nestjs/common';
import { isAddress } from 'viem';
import {
  GoPlusAddressService,
  GoPlusAddressResult,
} from '../threat-intelligence/goplus-address.service';

export type SpenderRiskLevel = 'HIGH' | 'REVIEW' | 'UNKNOWN';

export interface SpenderRiskResult {
  address: string;
  level: SpenderRiskLevel;
  code: string;
  warning: string;
  verifiedMalicious: boolean;
  indicators: string[];
  requiresReview: boolean;
}

@Injectable()
export class SpenderRiskService {
  constructor(
    private readonly goPlusAddressService: GoPlusAddressService,
  ) {}

  async analyzeSpender(address: string): Promise<SpenderRiskResult> {
    if (!isAddress(address)) {
      return {
        address,
        level: 'HIGH',
        code: 'INVALID_SPENDER_ADDRESS',
        warning: 'The spender address is invalid. Do not proceed without checking it.',
        verifiedMalicious: false,
        indicators: ['Invalid Ethereum-compatible address'],
        requiresReview: true,
      };
    }

    try {
      const result: GoPlusAddressResult =
        await this.goPlusAddressService.checkAddress(address);

      const threatFields: (keyof GoPlusAddressResult)[] = [
        'blacklist_doubt',
        'blackmail_activities',
        'cybercrime',
        'darkweb_transactions',
        'fake_kyc',
        'fake_standard_interface',
        'fake_token',
        'financial_crime',
        'gas_abuse',
        'honeypot_related_address',
        'malicious_mining_activities',
        'mixer',
        'money_laundering',
        'phishing_activities',
        'reinit',
        'sanctioned',
        'stealing_attack',
      ];

      const flaggedIndicators = threatFields.filter(
        (field) => result[field] === '1',
      );

      const maliciousContractsCreated = Number(
        result.number_of_malicious_contracts_created ?? '0',
      );

      if (maliciousContractsCreated > 0) {
        flaggedIndicators.push(
          'number_of_malicious_contracts_created',
        );
      }

      if (flaggedIndicators.length > 0) {
        return {
          address,
          level: 'HIGH',
          code: 'GOPLUS_THREAT_DETECTED',
          warning: 'GoPlus reported one or more threat indicators for this spender. Do not approve without further investigation.',
          verifiedMalicious: true,
          indicators: flaggedIndicators,
          requiresReview: true,
        };
      }

      return {
        address,
        level: 'REVIEW',
        code: 'NO_KNOWN_GOPLUS_THREATS',
        warning: 'GoPlus returned no listed threat indicators. This does not guarantee that the spender is safe. Review the contract before approving.',
        verifiedMalicious: false,
        indicators: ['No listed GoPlus threat indicators detected'],
        requiresReview: true,
      };
    } catch {
      return {
        address,
        level: 'UNKNOWN',
        code: 'GOPLUS_CHECK_UNAVAILABLE',
        warning: 'GoPlus threat intelligence is unavailable. The spender could not be verified. Review it before approving.',
        verifiedMalicious: false,
        indicators: ['GoPlus security lookup failed'],
        requiresReview: true,
      };
    }
  }
}
