import { describe, it, expect, vi } from 'vitest';
import { BlockchainService } from './blockchain.service';

const mockCall = vi.fn();
const mockGetBlockNumber = vi.fn();

vi.mock('viem', () => ({
  createPublicClient: () => ({
    call: mockCall,
    getBlockNumber: mockGetBlockNumber,
    getChainId: vi.fn(),
  }),
  http: vi.fn(),
}));

describe('BlockchainService Baseline (Multi-RPC)', () => {
  const service = new BlockchainService();
  const validTx = {
    chainId: 56,
    from: '0x1111111111111111111111111111111111111111',
    to: '0x2222222222222222222222222222222222222222',
    value: '0',
    data: '0x',
  };

  it('should call eth_call on both primary and secondary RPC providers', async () => {
    mockCall.mockResolvedValue({ data: '0x' });
    mockGetBlockNumber.mockResolvedValue(100n);
    
    await service.simulateTransaction(validTx);
    
    // Now expects 2 calls (primary + secondary)
    expect(mockCall).toHaveBeenCalledTimes(2);
  });
});