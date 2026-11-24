import { Injectable } from '@nestjs/common';
import {
  decodeFunctionData,
  formatUnits,
  parseAbi,
} from 'viem';

import type { Address, Hex } from 'viem';

const erc20Abi = parseAbi([
  'function transfer(address to, uint256 amount)',
  'function approve(address spender, uint256 amount)',
  'function transferFrom(address from, address to, uint256 amount)',
]);

// Standard "unlimited" values used by different tokens
const UNLIMITED_VALUES = [
  (1n << 256n) - 1n, // 2^256 - 1 (standard)
  (1n << 255n) - 1n, // 2^255 - 1 (common alternative)
  (1n << 160n) - 1n, // 2^160 - 1 (some tokens)
  (1n << 128n) - 1n, // 2^128 - 1 (rare)
  10n ** 30n,         // 1e30 (some tokens)
  10n ** 50n,         // 1e50 (USDT-like)
  10n ** 60n,         // 1e60
];

@Injectable()
export class Erc20Decoder {
  decode(data: Hex, decimals = 18) {
    if (!Number.isInteger(decimals) || decimals < 0 || decimals > 255) {
      throw new Error('Invalid token decimals.');
    }

    if (!/^0x[0-9a-fA-F]{8,}$/.test(data)) {
      return {
        recognized: false,
        type: 'UNKNOWN',
        message: 'Invalid or unsupported transaction calldata.',
      };
    }

    try {
      const decoded = decodeFunctionData({
        abi: erc20Abi,
        data,
      });

      if (decoded.functionName === 'transfer') {
        const [to, amount] = decoded.args as [Address, bigint];

        return {
          recognized: true,
          type: 'TRANSFER',
          recipient: to,
          rawAmount: amount.toString(),
          formattedAmount: formatUnits(amount, decimals),
        };
      }

      if (decoded.functionName === 'approve') {
        const [spender, amount] = decoded.args as [Address, bigint];

        // Check if amount is one of the common "unlimited" values
        const isUnlimited = UNLIMITED_VALUES.some(
          (val) => amount >= val,
        );

        return {
          recognized: true,
          type: 'APPROVE',
          spender,
          rawAmount: amount.toString(),
          formattedAmount: formatUnits(amount, decimals),
          unlimitedApproval: isUnlimited,
        };
      }

      if (decoded.functionName === 'transferFrom') {
        const [from, to, amount] = decoded.args as [
          Address,
          Address,
          bigint,
        ];

        return {
          recognized: true,
          type: 'TRANSFER_FROM',
          owner: from,
          recipient: to,
          rawAmount: amount.toString(),
          formattedAmount: formatUnits(amount, decimals),
        };
      }

      return {
        recognized: false,
        type: 'UNKNOWN',
        message: 'Unsupported ERC20 function.',
      };
    } catch {
      return {
        recognized: false,
        type: 'UNKNOWN',
        message: 'Unable to decode transaction calldata.',
      };
    }
  }
}