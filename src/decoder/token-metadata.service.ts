
import {
  Injectable,
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';

import {
  createPublicClient,
  http,
  parseAbi,
} from 'viem';

import type { Address } from 'viem';
import { bsc } from 'viem/chains';

const metadataAbi = parseAbi([
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function totalSupply() view returns (uint256)',
]);

@Injectable()
export class TokenMetadataService {
  private readonly client = createPublicClient({
    chain: bsc,
    transport: http(
      process.env.BNB_RPC_URL ||
      'https://bsc-dataseed.bnbchain.org',
      {
        timeout: 10_000,
        retryCount: 2,
      },
    ),
  });

  async getTokenMetadata(tokenAddress: string) {
    if (!/^0x[a-fA-F0-9]{40}$/.test(tokenAddress)) {
      throw new BadRequestException('Invalid token contract address.');
    }

    const address = tokenAddress as Address;

    try {
      const [name, symbol, decimals, totalSupply] =
        await Promise.all([
          this.client.readContract({
            address,
            abi: metadataAbi,
            functionName: 'name',
          }),
          this.client.readContract({
            address,
            abi: metadataAbi,
            functionName: 'symbol',
          }),
          this.client.readContract({
            address,
            abi: metadataAbi,
            functionName: 'decimals',
          }),
          this.client.readContract({
            address,
            abi: metadataAbi,
            functionName: 'totalSupply',
          }),
        ]);

      return {
        success: true,
        network: 'BNB Smart Chain',
        chainId: 56,
        token: address,
        name,
        symbol,
        decimals,
        rawTotalSupply: totalSupply.toString(),
        formattedTotalSupply: this.formatAmount(
          totalSupply,
          decimals,
        ),
        mode: 'read-only',
        limitations: [
          'Reads metadata directly from the token contract.',
          'Some tokens do not implement all standard ERC20 metadata functions.',
          'Returned metadata is not independently verified.',
        ],
      };
    } catch {
      throw new ServiceUnavailableException(
        'Unable to read token metadata from the BNB Chain RPC endpoint.',
      );
    }
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
