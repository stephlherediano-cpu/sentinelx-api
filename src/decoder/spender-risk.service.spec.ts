
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SpenderRiskService } from './spender-risk.service';
import { GoPlusAddressService } from '../threat-intelligence/goplus-address.service';

describe('SpenderRiskService', () => {
  const mockGoPlusAddressService = {
    checkAddress: vi.fn(),
  };

  const service = new SpenderRiskService(
    mockGoPlusAddressService as unknown as GoPlusAddressService,
  );

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return REVIEW when GoPlus reports no threat indicators', async () => {
    mockGoPlusAddressService.checkAddress.mockResolvedValue({
      cybercrime: '0',
      money_laundering: '0',
      phishing_activities: '0',
      stealing_attack: '0',
      sanctioned: '0',
      fake_token: '0',
      number_of_malicious_contracts_created: '0',
    });

    const result = await service.analyzeSpender(
      '0x3333333333333333333333333333333333333333',
    );

    expect(result.level).toBe('REVIEW');
    expect(result.code).toBe('NO_KNOWN_GOPLUS_THREATS');
    expect(result.verifiedMalicious).toBe(false);
    expect(result.requiresReview).toBe(true);
  });

  it('should return HIGH for an invalid address', async () => {
    const result = await service.analyzeSpender('0x12345');

    expect(result.level).toBe('HIGH');
    expect(result.code).toBe('INVALID_SPENDER_ADDRESS');
    expect(result.verifiedMalicious).toBe(false);
    expect(result.requiresReview).toBe(true);
    expect(mockGoPlusAddressService.checkAddress).not.toHaveBeenCalled();
  });

  it('should preserve the original spender address', async () => {
    const address =
      '0x3333333333333333333333333333333333333333';

    mockGoPlusAddressService.checkAddress.mockResolvedValue({});

    const result = await service.analyzeSpender(address);

    expect(result.address).toBe(address);
  });

  it('should return HIGH when GoPlus detects a threat', async () => {
    mockGoPlusAddressService.checkAddress.mockResolvedValue({
      phishing_activities: '1',
    });

    const result = await service.analyzeSpender(
      '0x3333333333333333333333333333333333333333',
    );

    expect(result.level).toBe('HIGH');
    expect(result.code).toBe('GOPLUS_THREAT_DETECTED');
    expect(result.verifiedMalicious).toBe(true);
    expect(result.indicators).toContain('phishing_activities');
  });

  it('should return UNKNOWN when GoPlus is unavailable', async () => {
    mockGoPlusAddressService.checkAddress.mockRejectedValue(
      new Error('GoPlus unavailable'),
    );

    const result = await service.analyzeSpender(
      '0x3333333333333333333333333333333333333333',
    );

    expect(result.level).toBe('UNKNOWN');
    expect(result.code).toBe('GOPLUS_CHECK_UNAVAILABLE');
    expect(result.requiresReview).toBe(true);
  });
});
