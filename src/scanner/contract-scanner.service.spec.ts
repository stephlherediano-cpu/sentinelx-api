import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ContractScannerService } from './contract-scanner.service';

const mockGetBytecode = vi.fn();

vi.mock('viem', () => ({
  createPublicClient: () => ({
    getBytecode: mockGetBytecode,
  }),
  http: vi.fn(),
}));

describe('ContractScannerService', () => {
  let service: ContractScannerService;

  const contractAddress = '0x1111111111111111111111111111111111111111';

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ContractScannerService();
  });

  it('should return isContract: false for an EOA (wallet)', async () => {
    mockGetBytecode.mockResolvedValue('0x');

    const result = await service.scanContract(contractAddress);

    expect(result.success).toBe(true);
    expect(result.isContract).toBe(false);
    expect(result.riskScore).toBe(0);
    expect(result.findings).toHaveLength(0);
  });

  it('should detect selfdestruct function in bytecode', async () => {
    // Bytecode with selfdestruct selector (0x9cb8a26a)
    mockGetBytecode.mockResolvedValue(
      '0x6080604052348015600f57600080fd5b506004361060285760003560e01c80639cb8a26a14602d575b600080fd',
    );

    const result = await service.scanContract(contractAddress);

    expect(result.success).toBe(true);
    expect(result.isContract).toBe(true);
    expect(result.riskLevel).toBe('HIGH');
    expect(result.findings.some((f) => f.functionName === 'selfdestruct')).toBe(true);
  });

  it('should detect mint function in bytecode', async () => {
    // Bytecode with mint selector (0x40c10f19)
    mockGetBytecode.mockResolvedValue(
      '0x6080604052348015600f57600080fd5b506004361060285760003560e01c806340c10f1914602d575b600080fd',
    );

    const result = await service.scanContract(contractAddress);

    expect(result.success).toBe(true);
    expect(result.isContract).toBe(true);
    expect(result.findings.some((f) => f.functionName === 'mint')).toBe(true);
  });

  it('should return LOW risk for a contract without dangerous functions', async () => {
    // Safe bytecode without dangerous selectors
    mockGetBytecode.mockResolvedValue(
      '0x6080604052348015600f57600080fd5b506004361060285760003560e01c8063a9059cbb14602d575b600080fd',
    );

    const result = await service.scanContract(contractAddress);

    expect(result.success).toBe(true);
    expect(result.isContract).toBe(true);
    expect(result.riskLevel).toBe('LOW');
    expect(result.findings).toHaveLength(0);
  });

  it('should handle RPC errors gracefully', async () => {
    mockGetBytecode.mockRejectedValue(new Error('RPC Node unavailable'));

    const result = await service.scanContract(contractAddress);

    expect(result.success).toBe(false);
    expect(result.isContract).toBeNull();
    expect(result.message).toContain('Unable to scan the contract');
  });
});