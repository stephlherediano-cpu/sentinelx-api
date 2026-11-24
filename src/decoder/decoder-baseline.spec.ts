import { describe, it, expect } from 'vitest';
import { Erc20Decoder } from './erc20-decoder';
import { encodeFunctionData, parseAbi } from 'viem';

const abi = parseAbi([
  'function transfer(address to, uint256 amount)',
  'function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline)',
]);

describe('Erc20Decoder Baseline', () => {
  const decoder = new Erc20Decoder();
  const address = '0x1111111111111111111111111111111111111111';

  it('should recognize TRANSFER', () => {
    const data = encodeFunctionData({ abi, functionName: 'transfer', args: [address, 100n] });
    const result = decoder.decode(data);
    expect(result.type).toBe('TRANSFER');
  });

  it('should NOT recognize SWAP functions yet (baseline expectation)', () => {
    const data = encodeFunctionData({
      abi,
      functionName: 'swapExactTokensForTokens',
      args: [100n, 90n, [address, address], address, 1000000n],
    });
    const result = decoder.decode(data);
    expect(result.recognized).toBe(false);
  });
});
