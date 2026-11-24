
import { afterEach, describe, expect, it } from 'vitest';
import { ThreatIntelligenceService } from './threat-intelligence.service';
import { writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const filePath = join(
  process.cwd(),
  'src',
  'threat-intelligence',
  'threat-addresses.json',
);

const originalFile = readFileSync(filePath, 'utf8');

const validRecord = {
  chainId: 56,
  address: '0x1111111111111111111111111111111111111111',
  source: 'Test threat intelligence source',
  evidence: 'https://example.com/test-evidence',
  verified: true,
  reportedAt: '2026-11-23T10:00:00Z',
};

const validFile = {
  version: '1.0.0',
  updatedAt: '2026-11-23T10:00:00Z',
  description: 'SentinelX test records',
  records: [validRecord],
};

function writeTestFile(data: unknown) {
  writeFileSync(filePath, JSON.stringify(data, null, 2));
}

describe('ThreatIntelligenceService', () => {
  afterEach(() => {
    writeFileSync(filePath, originalFile);
  });

  it('loads a valid threat record', () => {
    writeTestFile(validFile);

    const service = new ThreatIntelligenceService();

    expect(
      service.getVerifiedThreatAddresses(56).has(
        validRecord.address.toLowerCase(),
      ),
    ).toBe(true);
  });

  it('rejects an invalid wallet address', () => {
    writeTestFile({
      ...validFile,
      records: [{ ...validRecord, address: 'invalid-address' }],
    });

    expect(() => new ThreatIntelligenceService()).toThrow();
  });

  it('rejects an unsupported chain ID', () => {
    writeTestFile({
      ...validFile,
      records: [{ ...validRecord, chainId: 999 }],
    });

    expect(() => new ThreatIntelligenceService()).toThrow();
  });

  it('rejects missing source', () => {
    const { source, ...record } = validRecord;

    writeTestFile({
      ...validFile,
      records: [record],
    });

    expect(() => new ThreatIntelligenceService()).toThrow();
  });

  it('rejects missing evidence', () => {
    const { evidence, ...record } = validRecord;

    writeTestFile({
      ...validFile,
      records: [record],
    });

    expect(() => new ThreatIntelligenceService()).toThrow();
  });

  it('rejects invalid date-time', () => {
    writeTestFile({
      ...validFile,
      records: [{ ...validRecord, reportedAt: 'not-a-date' }],
    });

    expect(() => new ThreatIntelligenceService()).toThrow();
  });

  it('rejects records not marked verified', () => {
    writeTestFile({
      ...validFile,
      records: [{ ...validRecord, verified: false }],
    });

    expect(() => new ThreatIntelligenceService()).toThrow();
  });

  it('accepts an empty records array', () => {
    writeTestFile({
      ...validFile,
      records: [],
    });

    const service = new ThreatIntelligenceService();

    expect(service.getVerifiedThreatAddresses(56).size).toBe(0);
  });
    it('rejects malformed JSON', () => {
    writeFileSync(filePath, '{ invalid json');

    expect(() => new ThreatIntelligenceService()).toThrow();
  });
});
