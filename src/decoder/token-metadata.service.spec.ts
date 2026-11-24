
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TokenMetadataService } from './token-metadata.service';

const mockReadContract = vi.fn();

vi.mock('viem', () => ({
  createPublicClient: () => ({
    readContract: mockReadContract,
  }),
  http: vi.fn(),
  parseAbi: vi.fn(),
}));

describe('TokenMetadataService', () => {
  let service: TokenMetadataService;

  const tokenAddress = '0x55d398326f99059fF775485246999027B3197955';

  beforeEach(() => {
    vi.clearAllMocks();
    service = new TokenMetadataService();
  });

  it('should return token metadata successfully', async () => {
    mockReadContract
      .mockResolvedValueOnce('Tether USD')
      .mockResolvedValueOnce('USDT')
      .mockResolvedValueOnce(18)
      .mockResolvedValueOnce(1000000000000000000000n);

    const result = await service.getTokenMetadata(tokenAddress);

    expect(result.success).toBe(true);
    expect(result.name).toBe('Tether USD');
    expect(result.symbol).toBe('USDT');
    expect(result.decimals).toBe(18);
    expect(result.rawTotalSupply).toBe('1000000000000000000000');
    expect(result.formattedTotalSupply).toBe('1000');
    expect(mockReadContract).toHaveBeenCalledTimes(4);
  });

  it('should format tokens with 6 decimals correctly', async () => {
    mockReadContract
      .mockResolvedValueOnce('USD Coin')
      .mockResolvedValueOnce('USDC')
      .mockResolvedValueOnce(6)
      .mockResolvedValueOnce(123456789n);

    const result = await service.getTokenMetadata(tokenAddress);

    expect(result.decimals).toBe(6);
    expect(result.formattedTotalSupply).toBe('123.456789');
  });

  it('should format tokens with zero decimals correctly', async () => {
    mockReadContract
      .mockResolvedValueOnce('Test Token')
      .mockResolvedValueOnce('TEST')
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(123n);

    const result = await service.getTokenMetadata(tokenAddress);

    expect(result.formattedTotalSupply).toBe('123');
  });

  it('should reject an invalid token address', async () => {
    await expect(
      service.getTokenMetadata('invalid-address'),
    ).rejects.toThrow('Invalid token contract address.');

    expect(mockReadContract).not.toHaveBeenCalled();
  });

  it('should handle RPC metadata errors', async () => {
    mockReadContract.mockRejectedValue(
      new Error('RPC endpoint unavailable'),
    );

    await expect(
      service.getTokenMetadata(tokenAddress),
    ).rejects.toThrow(
      'Unable to read token metadata from the BNB Chain RPC endpoint.',
    );
  });
});
