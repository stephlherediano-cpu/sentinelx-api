import { Injectable, Logger } from '@nestjs/common';
import { createPublicClient, http } from 'viem';
import type { Address, Hex } from 'viem';
import { bsc } from 'viem/chains';

// Common dangerous function selectors (4-byte hashes)
const DANGEROUS_SELECTORS: Record<string, { name: string; severity: 'HIGH' | 'MEDIUM' | 'LOW' }> = {
  // selfdestruct() - destroys the contract, funds are lost
  '0x9cb8a26a': { name: 'selfdestruct', severity: 'HIGH' },
  // selfdestruct(address) - sends remaining funds to an address
  '0x6c7b0e5e': { name: 'selfdestruct(address)', severity: 'HIGH' },
  // mint(address,uint256) - can create unlimited tokens
  '0x40c10f19': { name: 'mint', severity: 'HIGH' },
  // burn(uint256) - burns tokens (can be risky if abused)
  '0x42966c68': { name: 'burn', severity: 'MEDIUM' },
  // pause() - pauses the contract
  '0x8456cb59': { name: 'pause', severity: 'MEDIUM' },
  // blacklist(address) - can freeze funds
  '0xf9f92be4': { name: 'blacklist', severity: 'HIGH' },
  // transferOwnership(address) - ownership takeover
  '0xf2fde38b': { name: 'transferOwnership', severity: 'MEDIUM' },
};

@Injectable()
export class ContractScannerService {
  private readonly logger = new Logger(ContractScannerService.name);

  private readonly client = createPublicClient({
    chain: bsc,
    transport: http(
      process.env.BNB_RPC_URL || 'https://bsc-dataseed.bnbchain.org',
      { timeout: 10_000, retryCount: 2 },
    ),
  });

  async scanContract(contractAddress: string) {
    try {
            // Step 1: Fetch the bytecode of the contract
      const bytecode: Hex | undefined = await this.client.getBytecode({
        address: contractAddress as Address,
      });

      // If no bytecode, it's an EOA (wallet) not a contract
      if (!bytecode || bytecode === '0x') {
        return {
          success: true,
          isContract: false,
          address: contractAddress,
          message: 'This address is a regular wallet (EOA), not a smart contract.',
          findings: [],
          riskScore: 0,
        };
      }

      // Step 2: Scan for dangerous function selectors
      const findings: {
        functionName: string;
        severity: 'HIGH' | 'MEDIUM' | 'LOW';
        description: string;
      }[] = [];

      for (const [selector, info] of Object.entries(DANGEROUS_SELECTORS)) {
        // Selectors in bytecode are 4 bytes. We search for them as hex strings.
        // Note: This is a heuristic. It can have false positives.
        if (bytecode.toLowerCase().includes(selector.slice(2))) {
          findings.push({
            functionName: info.name,
            severity: info.severity,
            description: `Contract bytecode contains the "${info.name}" function. This could be dangerous if abused.`,
          });
        }
      }

      // Step 3: Calculate risk score
      let riskScore = 0;

      for (const finding of findings) {
        if (finding.severity === 'HIGH') riskScore += 50;
        else if (finding.severity === 'MEDIUM') riskScore += 25;
        else riskScore += 10;
      }

      riskScore = Math.min(100, riskScore);

      let riskLevel: string;
      if (riskScore >= 80) riskLevel = 'CRITICAL';
      else if (riskScore >= 50) riskLevel = 'HIGH';
      else if (riskScore >= 20) riskLevel = 'REVIEW';
      else riskLevel = 'LOW';

      return {
        success: true,
        isContract: true,
        address: contractAddress,
        findings,
        riskScore,
        riskLevel,
        mode: 'read-only',
        limitations: [
          'Bytecode scanning is a heuristic and can produce false positives.',
          'Some contracts use proxies and the logic is in a separate implementation contract.',
          'A contract without dangerous functions can still be malicious.',
          'This scan does not guarantee that a contract is safe.',
        ],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Contract scan failed: ${message}`);

      return {
        success: false,
        isContract: null,
        address: contractAddress,
        message: 'Unable to scan the contract. The RPC provider may be unavailable.',
        findings: [],
        riskScore: 0,
      };
    }
  }
}