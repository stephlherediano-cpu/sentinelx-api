
import { describe, it, expect } from 'vitest';
import { encodeFunctionData } from 'viem';
import { Erc20Decoder } from './erc20-decoder';

describe('Erc20Decoder', () => {
  const decoder = new Erc20Decoder();

  const recipient = '0x2222222222222222222222222222222222222222';
  const owner = '0x1111111111111111111111111111111111111111';

  it('should decode an ERC20 transfer', () => {
    const data = encodeFunctionData({
      abi: [
        {
          type: 'function',
          name: 'transfer',
          stateMutability: 'nonpayable',
          inputs: [
            { name: 'to', type: 'address' },
            { name: 'amount', type: 'uint256' },
          ],
          outputs: [{ name: '', type: 'bool' }],
        },
      ],
      functionName: 'transfer',
      args: [recipient, 1000000000000000000n],
    });

    const result = decoder.decode(data);

    expect(result.recognized).toBe(true);
    expect(result.type).toBe('TRANSFER');
    expect(result.formattedAmount).toBe('1');
  });

  it('should decode an ERC20 approval', () => {
    const data = encodeFunctionData({
      abi: [
        {
          type: 'function',
          name: 'approve',
          stateMutability: 'nonpayable',
          inputs: [
            { name: 'spender', type: 'address' },
            { name: 'amount', type: 'uint256' },
          ],
          outputs: [{ name: '', type: 'bool' }],
        },
      ],
      functionName: 'approve',
      args: [recipient, 5000000000000000000n],
    });

    const result = decoder.decode(data);

    expect(result.recognized).toBe(true);
    expect(result.type).toBe('APPROVE');
    expect(result.spender).toBe(recipient);
    expect(result.formattedAmount).toBe('5');
    expect(result.unlimitedApproval).toBe(false);
  });

  it('should detect unlimited approval', () => {
    const data = encodeFunctionData({
      abi: [
        {
          type: 'function',
          name: 'approve',
          stateMutability: 'nonpayable',
          inputs: [
            { name: 'spender', type: 'address' },
            { name: 'amount', type: 'uint256' },
          ],
          outputs: [{ name: '', type: 'bool' }],
        },
      ],
      functionName: 'approve',
      args: [recipient, (1n << 256n) - 1n],
    });

    const result = decoder.decode(data);

    expect(result.type).toBe('APPROVE');
    expect(result.unlimitedApproval).toBe(true);
  });

  it('should decode transferFrom', () => {
    const data = encodeFunctionData({
      abi: [
        {
          type: 'function',
          name: 'transferFrom',
          stateMutability: 'nonpayable',
          inputs: [
            { name: 'from', type: 'address' },
            { name: 'to', type: 'address' },
            { name: 'amount', type: 'uint256' },
          ],
          outputs: [{ name: '', type: 'bool' }],
        },
      ],
      functionName: 'transferFrom',
      args: [owner, recipient, 2000000000000000000n],
    });

    const result = decoder.decode(data);

    expect(result.recognized).toBe(true);
    expect(result.type).toBe('TRANSFER_FROM');
    expect(result.owner).toBe(owner);
    expect(result.recipient).toBe(recipient);
    expect(result.formattedAmount).toBe('2');
  });

  it('should reject invalid calldata', () => {
    const result = decoder.decode('0x1234');

    expect(result.recognized).toBe(false);
    expect(result.type).toBe('UNKNOWN');
  });

  it('should reject invalid decimals', () => {
    expect(() => decoder.decode('0x12345678', 256)).toThrow(
      'Invalid token decimals.',
    );
  });
});
