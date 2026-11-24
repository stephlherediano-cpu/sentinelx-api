
import { Injectable } from '@nestjs/common';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';

const threatRecordSchema = z.object({
 chainId: z.union([
  z.literal(56),
  z.literal(1),
  z.literal(137),
  z.literal(42161),
]),

  address: z.string()
    .regex(/^0x[a-fA-F0-9]{40}$/),

  source: z.string().trim().min(1),

  evidence: z.string().trim().min(1),

  verified: z.literal(true),

  reportedAt: z.string().datetime({ offset: true }),
}).strict();

const threatFileSchema = z.object({
  version: z.string().min(1),

  updatedAt: z.string()
    .datetime({ offset: true })
    .nullable(),

  description: z.string().min(1),

  records: z.array(threatRecordSchema),
}).strict();

type ThreatRecord = z.infer<typeof threatRecordSchema>;

@Injectable()
export class ThreatIntelligenceService {
  private readonly records: ThreatRecord[];

  constructor() {
    const sourcePath = join(
  process.cwd(),
  'src',
  'threat-intelligence',
  'threat-addresses.json',
);

const compiledPath = join(
  process.cwd(),
  'dist',
  'threat-intelligence',
  'threat-addresses.json',
);

const filePath =
  process.env.NODE_ENV === 'test'
    ? sourcePath
    : existsSync(compiledPath)
      ? compiledPath
      : sourcePath;

    const rawFile = readFileSync(filePath, 'utf8');
    const parsedJson: unknown = JSON.parse(rawFile);

    const validation = threatFileSchema.safeParse(parsedJson);

    if (!validation.success) {
      throw new Error(
        `Invalid threat intelligence file: ${validation.error.message}`,
      );
    }

    this.records = validation.data.records;
  }

  getVerifiedThreatAddresses(chainId: number): Set<string> {
    return new Set(
      this.records
        .filter((record) => record.chainId === chainId)
        .map((record) => record.address.toLowerCase()),
    );
  }
}
