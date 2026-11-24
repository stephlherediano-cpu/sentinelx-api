import { describe, it, expect, vi, beforeEach } from 'vitest';
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

describe('BlockchainService (Multi-RPC)', () => {
  let service: BlockchainService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new BlockchainService();
  });

  const validTransaction = {
    chainId: 56,
    from: '0x1111111111111111111111111111111111111111',
    to: '0x2222222222222222222222222222222222222222',
    value: '0',
    data: '0x',
  };

  it('should simulate a successful BNB transaction and verify consistency', async () => {
    mockCall.mockResolvedValue({ data: '0x1234' });
    mockGetBlockNumber.mockResolvedValue(123456n);

    const result = await service.simulateTransaction(validTransaction);

    expect(result.success).toBe(true);
    expect(result.chainId).toBe(56);
    // @ts-expect-error: TS doesn't know the return type from Promise.allSettled
    expect(result.primaryReturnData).toBe('0x1234');
    // @ts-expect-error
    expect(result.secondaryReturnData).toBe('0x1234');
    // @ts-expect-error
    expect(result.verified).toBe(true);
    // @ts-expect-error
    expect(result.verification).toBe('CONSISTENT');
    expect(mockCall).toHaveBeenCalledTimes(2);
  });

  it('should detect RPC discrepancy if providers return different data', async () => {
    mockCall
      .mockResolvedValueOnce({ data: '0x1234' })
      .mockResolvedValueOnce({ data: '0x5678' });
    mockGetBlockNumber.mockResolvedValue(123456n);

    const result = await service.simulateTransaction(validTransaction);

    expect(result.success).toBe(true);
    // @ts-expect-error
    expect(result.verified).toBe(false);
    // @ts-expect-error
    expect(result.verification).toBe('INCONSISTENT_RETURN_DATA');
  });

  it('should reject unsupported blockchain networks', async () => {
    await expect(
      service.simulateTransaction({
        ...validTransaction,
        chainId: 1,
      }),
    ).rejects.toThrow(
      'Transaction simulation currently supports BNB Chain only.',
    );

    expect(mockCall).not.toHaveBeenCalled();
  });

  it('should return EXECUTION_REVERTED when transaction execution reverts', async () => {
    mockCall.mockRejectedValue(
      new Error('Execution reverted with reason: 0x'),
    );

    const result = await service.simulateTransaction(validTransaction);

    expect(result.success).toBe(false);
    expect(result.code).toBe('EXECUTION_REVERTED');
    expect(result.network).toBe('BNB Smart Chain');
    expect(result.mode).toBe('read-only');
  });

  it('should propagate an RPC connection error when both providers fail', async () => {
    mockCall.mockRejectedValue(new Error('RPC endpoint unavailable'));

    await expect(
      service.simulateTransaction(validTransaction),
    ).rejects.toThrow('Both primary and secondary RPC providers are unavailable.');
  });
});