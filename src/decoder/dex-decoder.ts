import { Injectable } from '@nestjs/common';
import { decodeFunctionData, parseAbi } from 'viem';
import type { Address, Hex } from 'viem';

// Standard PancakeSwap/Uniswap V2 Router ABI
const dexV2Abi = parseAbi([
  'function swapExactTokensForTokens(uint256 amountIn, uint256 amountOutMin, address[] calldata path, address to, uint256 deadline)',
  'function swapExactETHForTokens(uint256 amountOutMin, address[] calldata path, address to, uint256 deadline)',
  'function swapExactTokensForETH(uint256 amountIn, uint256 amountOutMin, address[] calldata path, address to, uint256 deadline)',
]);

// Standard PancakeSwap/Uniswap V3 Router ABI (Simplified for exactInputSingle)
const dexV3Abi = parseAbi([
  'function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96) params)',
]);

@Injectable()
export class DexDecoder {
  decode(data: Hex) {
    if (!/^0x[0-9a-fA-F]{8,}$/.test(data)) {
      return {
        recognized: false,
        type: 'UNKNOWN',
        message: 'Invalid or unsupported calldata.',
      };
    }

    // 1. Try to decode as V2 Swap
    try {
      const decodedV2 = decodeFunctionData({
        abi: dexV2Abi,
        data,
      });

      if (decodedV2.functionName === 'swapExactTokensForTokens') {
        const [amountIn, amountOutMin, path, to] = decodedV2.args as unknown as [bigint, bigint, readonly Address[], Address];
        return {
          recognized: true,
          type: 'DEX_SWAP_V2',
          protocol: 'V2',
          amountIn: amountIn.toString(),
          amountOutMin: amountOutMin.toString(),
          path: path,
          tokenIn: path[0],
          tokenOut: path[path.length - 1],
          recipient: to,
          slippageRisk: amountOutMin === 0n ? 'HIGH' : 'NORMAL',
        };
      }

      if (decodedV2.functionName === 'swapExactETHForTokens') {
        const [amountOutMin, path, to] = decodedV2.args as unknown as [bigint, readonly Address[], Address];
        return {
          recognized: true,
          type: 'DEX_SWAP_V2',
          protocol: 'V2',
          amountIn: 'NATIVE_ETH', // Exact amount is in tx.value, not in calldata
          amountOutMin: amountOutMin.toString(),
          path: path,
          tokenIn: path[0], // Usually WETH/WBNB
          tokenOut: path[path.length - 1],
          recipient: to,
          slippageRisk: amountOutMin === 0n ? 'HIGH' : 'NORMAL',
        };
      }

      if (decodedV2.functionName === 'swapExactTokensForETH') {
        const [amountIn, amountOutMin, path, to] = decodedV2.args as unknown as [bigint, bigint, readonly Address[], Address];
        return {
          recognized: true,
          type: 'DEX_SWAP_V2',
          protocol: 'V2',
          amountIn: amountIn.toString(),
          amountOutMin: amountOutMin.toString(),
          path: path,
          tokenIn: path[0],
          tokenOut: path[path.length - 1], // Usually WETH/WBNB
          recipient: to,
          slippageRisk: amountOutMin === 0n ? 'HIGH' : 'NORMAL',
        };
      }
    } catch {
      // Ignore and try V3
    }

    // 2. Try to decode as V3 Swap
    try {
      const decodedV3 = decodeFunctionData({
        abi: dexV3Abi,
        data,
      });

      if (decodedV3.functionName === 'exactInputSingle') {
        const [params] = decodedV3.args as unknown as [any];

        return {
          recognized: true,
          type: 'DEX_SWAP_V3',
          protocol: 'V3',
          amountIn: params.amountIn.toString(),
          amountOutMin: params.amountOutMinimum.toString(),
          tokenIn: params.tokenIn,
          tokenOut: params.tokenOut,
          recipient: params.recipient,
          feeTier: params.fee.toString(),
          slippageRisk: params.amountOutMinimum === 0n ? 'HIGH' : 'NORMAL',
        };
      }
    } catch {
      // Ignore
    }

    return {
      recognized: false,
      type: 'UNKNOWN',
      message: 'Unsupported DEX function or unrecognized calldata.',
    };
  }
}