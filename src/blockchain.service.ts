import {
  Injectable,
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';

import { createPublicClient, http } from 'viem';
import type { Address, Hex } from 'viem';
import { bsc } from 'viem/chains';
import type { TransactionInput } from './transaction/transaction.dto';

@Injectable()
export class BlockchainService {
  // RPC 1: Official BNB Chain
  private readonly primaryClient = createPublicClient({
    chain: bsc,
    transport: http(
      process.env.BNB_RPC_URL_PRIMARY || 'https://bsc-dataseed.bnbchain.org',
      { timeout: 10_000, retryCount: 1 },
    ),
  });

  // RPC 2: Independent Secondary Provider
  private readonly secondaryClient = createPublicClient({
    chain: bsc,
    transport: http(
      process.env.BNB_RPC_URL_SECONDARY || 'https://bsc-rpc.publicnode.com',
      { timeout: 10_000, retryCount: 1 },
    ),
  });

  async simulateTransaction(tx: TransactionInput) {
    if (tx.chainId !== 56) {
      throw new BadRequestException(
        'Transaction simulation currently supports BNB Chain only.',
      );
    }

    const payload = {
      account: tx.from as Address,
      to: tx.to as Address,
      value: BigInt(tx.value),
      data: tx.data as Hex,
    };

    // Run both simulations in parallel
    const [primaryResult, secondaryResult] = await Promise.allSettled([
      this.primaryClient.call(payload),
      this.secondaryClient.call(payload),
    ]);

    // If both fail, propagate error
    if (primaryResult.status === 'rejected' && secondaryResult.status === 'rejected') {
      const error = primaryResult.reason;
      const message = error instanceof Error ? error.message : '';

      if (/execution reverted/i.test(message)) {
        return this.buildRevertResponse();
      }

      throw new ServiceUnavailableException(
        'Both primary and secondary RPC providers are unavailable.',
      );
    }

    // If one fails and the other succeeds, we have a network discrepancy
    if (primaryResult.status !== secondaryResult.status) {
      return {
        success: false,
        code: 'RPC_DISCREPANCY',
        message:
          'One RPC provider failed while the other succeeded. Network state may be inconsistent.',
        network: 'BNB Smart Chain',
        chainId: 56,
        blockNumber: null,
        mode: 'read-only',
        limitations: [
          'Independent verification failed due to provider disagreement.',
          'Do not proceed without manual inspection.',
        ],
      };
    }

    // Both succeeded - TypeScript knows they are fulfilled
    const primaryData =
      primaryResult.status === 'fulfilled'
        ? primaryResult.value.data ?? '0x'
        : '0x';

    const secondaryData =
      secondaryResult.status === 'fulfilled'
        ? secondaryResult.value.data ?? '0x'
        : '0x';

    const isConsistent = primaryData === secondaryData;

    const blockNumber = await this.primaryClient.getBlockNumber();

    return {
      success: true,
      verified: isConsistent,
      verification: isConsistent ? 'CONSISTENT' : 'INCONSISTENT_RETURN_DATA',
      network: 'BNB Smart Chain',
      chainId: 56,
      blockNumber: blockNumber.toString(),
      primaryReturnData: primaryData,
      secondaryReturnData: secondaryData,
      mode: 'read-only',
      limitations: [
        'Simulation uses eth_call against blockchain state.',
        'Two independent RPC providers were queried for verification.',
        isConsistent
          ? 'Both providers returned consistent data.'
          : 'Providers returned different data. Do not trust the simulation without further investigation.',
        'A successful simulation does not guarantee transaction safety.',
      ],
    };
  }

  private buildRevertResponse() {
    return {
      success: false,
      code: 'EXECUTION_REVERTED',
      message: 'Transaction execution reverted on BNB Chain.',
      network: 'BNB Smart Chain',
      chainId: 56,
      blockNumber: null,
      returnData: null,
      mode: 'read-only',
      limitations: [
        'The transaction execution failed during eth_call.',
        'No transaction was broadcast to the blockchain.',
      ],
    };
  }

  async getStatus() {
    try {
      const [chainId, blockNumber] = await Promise.all([
        this.primaryClient.getChainId(),
        this.primaryClient.getBlockNumber(),
      ]);

      return {
        network: 'BNB Smart Chain',
        expectedChainId: 56,
        actualChainId: chainId,
        blockNumber: blockNumber.toString(),
        connected: chainId === 56,
        mode: 'read-only',
        providers: ['Primary', 'Secondary'],
      };
    } catch {
      return {
        network: 'BNB Smart Chain',
        expectedChainId: 56,
        actualChainId: null,
        blockNumber: null,
        connected: false,
        mode: 'read-only',
        message: 'Unable to connect to the configured BNB RPC endpoint.',
      };
    }
  }
}