import { Injectable, Logger } from '@nestjs/common';
import { CongestionLevel, MempoolSnapshot } from '../interfaces/gas-fee.interfaces';

/**
 * MempoolProviderService
 *
 * Abstracts real-time on-chain mempool data retrieval.
 * In production this would call an RPC node (e.g. via ethers.js / viem)
 * or a data provider (Alchemy, Infura, Blocknative).
 *
 * The public `getSnapshot(chainId)` method is intentionally thin so it can
 * be replaced/mocked in unit tests without touching recommendation logic.
 */
@Injectable()
export class MempoolProviderService {
  private readonly logger = new Logger(MempoolProviderService.name);

  /**
   * Returns a normalised mempool snapshot for the requested chain.
   * Concrete RPC integration is injected here; for now the stub returns
   * representative mainnet-like figures that exercises the full
   * recommendation pipeline.
   */
  async getSnapshot(chainId: number): Promise<MempoolSnapshot> {
    this.logger.debug(`Fetching mempool snapshot for chainId=${chainId}`);

    // ----- Replace the block below with real RPC calls -----
    const baseFeeGwei = await this.fetchBaseFee(chainId);
    const pendingTxCount = await this.fetchPendingTxCount(chainId);
    const recentBlockTimes = await this.fetchRecentBlockTimes(chainId);
    const { p25, p50, p75 } = await this.fetchPriorityFeePercentiles(chainId);
    // -------------------------------------------------------

    const recentInclusionRates = this.deriveInclusionRates(pendingTxCount);
    const congestionLevel = this.deriveCongestionLevel(pendingTxCount, baseFeeGwei);

    return {
      baseFeeGwei,
      pendingTxCount,
      recentBlockTimes,
      recentInclusionRates,
      p25PriorityFee: p25,
      p50PriorityFee: p50,
      p75PriorityFee: p75,
      congestionLevel,
    };
  }

  // ---------------------------------------------------------------------------
  // Stubbed RPC helpers — swap these out for real provider calls
  // ---------------------------------------------------------------------------

  protected async fetchBaseFee(_chainId: number): Promise<number> {
    // e.g. provider.getFeeData().maxFeePerGas converted to gwei
    return 32;
  }

  protected async fetchPendingTxCount(_chainId: number): Promise<number> {
    // e.g. provider.send('txpool_status', [])
    return 8_500;
  }

  protected async fetchRecentBlockTimes(_chainId: number): Promise<number[]> {
    // milliseconds between the last 10 block timestamps
    return [12_100, 12_300, 11_900, 12_050, 12_400, 11_800, 12_200, 12_000, 12_150, 12_250];
  }

  protected async fetchPriorityFeePercentiles(
    _chainId: number,
  ): Promise<{ p25: number; p50: number; p75: number }> {
    // e.g. eth_feeHistory percentiles [25, 50, 75]
    return { p25: 1.5, p50: 2.0, p75: 3.0 };
  }

  // ---------------------------------------------------------------------------
  // Derived metrics
  // ---------------------------------------------------------------------------

  private deriveInclusionRates(pendingTxCount: number): MempoolSnapshot['recentInclusionRates'] {
    // Heuristic: higher mempool pressure → lower inclusion for low-tip txs
    if (pendingTxCount < 5_000) return { low: 0.9, medium: 0.98, high: 0.999 };
    if (pendingTxCount < 15_000) return { low: 0.6, medium: 0.9, high: 0.99 };
    if (pendingTxCount < 30_000) return { low: 0.3, medium: 0.75, high: 0.97 };
    return { low: 0.1, medium: 0.5, high: 0.92 };
  }

  private deriveCongestionLevel(pendingTxCount: number, baseFeeGwei: number): CongestionLevel {
    const score = pendingTxCount / 1_000 + baseFeeGwei / 10;
    if (score < 5) return CongestionLevel.LOW;
    if (score < 15) return CongestionLevel.MEDIUM;
    if (score < 30) return CongestionLevel.HIGH;
    return CongestionLevel.CRITICAL;
  }
}
