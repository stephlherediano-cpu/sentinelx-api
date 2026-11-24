import { describe, it, expect } from 'vitest';
import { encodeFunctionData, parseAbi } from 'viem';
import { DexDecoder } from './dex-decoder';

const dexV2Abi = parseAbi([
  'function swapExactTokensForTokens(uint256 amountIn, uint256 amountOutMin, address[] calldata path, address to, uint256 deadline)',
]);

describe('DexDecoder (PancakeSwap/Uniswap)', () => {
  const decoder = new DexDecoder();
  const tokenA = '0x1111111111111111111111111111111111111111';
  const tokenB = '0x2222222222222222222222222222222222222222';
  const recipient = '0x3333333333333333333333333333333333333333';

  it('should decode a standard V2 swapExactTokensForTokens', () => {
    const data = encodeFunctionData({
      abi: dexV2Abi,
      functionName: 'swapExactTokensForTokens',
      args: [
        1000000n, // amountIn
        900000n,  // amountOutMin
        [tokenA, tokenB],
        recipient,
        BigInt(Math.floor(Date.now() / 1000) + 3600),
      ],
    });

    const result = decoder.decode(data);

    expect(result.recognized).toBe(true);
    expect(result.type).toBe('DEX_SWAP_V2');
    expect(result.tokenIn).toBe(tokenA);
    expect(result.tokenOut).toBe(tokenB);
    expect(result.amountIn).toBe('1000000');
    expect(result.slippageRisk).toBe('NORMAL');
  });

  it('should flag HIGH slippage risk if amountOutMin is 0', () => {
    const data = encodeFunctionData({
      abi: dexV2Abi,
      functionName: 'swapExactTokensForTokens',
      args: [
        1000000n,
        0n, // amountOutMin = 0 (No slippage protection!)
        [tokenA, tokenB],
        recipient,
        BigInt(Math.floor(Date.now() / 1000) + 3600),
      ],
    });

    const result = decoder.decode(data);

    expect(result.recognized).toBe(true);
    expect(result.slippageRisk).toBe('HIGH');
  });

  it('should reject invalid or unsupported calldata', () => {
    const result = decoder.decode('0x12345678');
    expect(result.recognized).toBe(false);
    expect(result.type).toBe('UNKNOWN');
  });
});