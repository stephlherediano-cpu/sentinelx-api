import {
  Injectable,
  ServiceUnavailableException,
  BadRequestException,
  Logger,
} from '@nestjs/common';

import { isAddress } from 'viem';
import { GoPlusAuthService } from './goplus-auth.service';

export interface GoPlusAddressResult {
  blacklist_doubt?: string;
  blackmail_activities?: string;
  contract_address?: string;
  cybercrime?: string;
  darkweb_transactions?: string;
  data_source?: string;
  fake_kyc?: string;
  fake_standard_interface?: string;
  fake_token?: string;
  financial_crime?: string;
  gas_abuse?: string;
  honeypot_related_address?: string;
  malicious_mining_activities?: string;
  mixer?: string;
  money_laundering?: string;
  number_of_malicious_contracts_created?: string;
  phishing_activities?: string;
  reinit?: string;
  sanctioned?: string;
  stealing_attack?: string;
}

interface GoPlusAddressResponse {
  code?: number;
  message?: string;
  result?: GoPlusAddressResult;
}

@Injectable()
export class GoPlusAddressService {
private readonly logger = new Logger(GoPlusAddressService.name);
  constructor(
    private readonly goPlusAuthService: GoPlusAuthService,
  ) {}

  async checkAddress(address: string): Promise<GoPlusAddressResult> {
  if (!isAddress(address)) {
    throw new BadRequestException(
      'Invalid wallet address.',
    );
  }
    try {
      const accessToken =
        await this.goPlusAuthService.getAccessToken();

      const url = new URL(
        `https://api.gopluslabs.io/api/v1/address_security/${encodeURIComponent(address)}`,
      );

      url.searchParams.set('chain_id', '56');

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          accept: 'application/json',
          Authorization: accessToken.startsWith('Bearer ')
  ? accessToken
  : `Bearer ${accessToken}`,
        },
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        throw new Error(
          `GoPlus address API HTTP ${response.status}`,
        );
      }

      const data =
        (await response.json()) as GoPlusAddressResponse;

      if (data.code !== 1 || !data.result) {
        throw new Error(
          data.message || 'GoPlus address check failed.',
        );
      }

      return data.result;
    } catch (error) {
  const message =
    error instanceof Error ? error.message : 'Unknown error';

  this.logger.error(`GoPlus address check failed: ${message}`);

  throw new ServiceUnavailableException(
    'Unable to retrieve address security information from GoPlus.',
  );
}
  }
}
	