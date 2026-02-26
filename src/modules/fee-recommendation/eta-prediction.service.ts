import { Injectable } from '@nestjs/common';
import { CongestionLevel, MempoolSnapshot } from '../interfaces/gas-fee.interfaces';
import { GasTier } from '../enums/gas-tier.enum';

/**
 * EtaPredictionService
 *
 * Deterministic heuristic model for estimating confirmation time per gas tier.
 *
 * Heuristic rationale
 * -------------------
 * 1. Derive the *average block time* from `recentBlockTimes`.
 * 2. Estimate the number of blocks a transaction at each priority level must
 *    wait before being included, using the tier's inclusion rate as a proxy
 *    for "how competitive" the priority fee is relative to current mempool.
 *    - inclusion_rate → expected_blocks_to_wait = ceil(1 / inclusion_rate)
 *    - This models the geometric distribution: the tx has `inclusion_rate`
 *      chance of being picked up in any given block.
 * 3. Apply a congestion multiplier so heavy-mempool conditions stretch ETAs.
 * 4. Format the result as a human-readable string.
 */
@Injectable()
export class EtaPredictionService {
  /**
   * Returns a human-readable ETA string for the given tier.
   */
  predict(tier: GasTier, snapshot: MempoolSnapshot): string {
    const avgBlockMs = this.averageBlockTime(snapshot.recentBlockTimes);
    const inclusionRate = snapshot.recentInclusionRates[tier];
    const congestionMultiplier = this.congestionMultiplier(snapshot.congestionLevel);

    // Expected number of blocks until inclusion (geometric distribution mean)
    const expectedBlocks = Math.ceil(1 / inclusionRate);
    const rawMs = expectedBlocks * avgBlockMs * congestionMultiplier;

    return this.formatDuration(rawMs);
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  /** Arithmetic mean of recent block times (ms). Falls back to 12 s. */
  averageBlockTime(blockTimes: number[]): number {
    if (!blockTimes?.length) return 12_000;
    return blockTimes.reduce((a, b) => a + b, 0) / blockTimes.length;
  }

  /**
   * Scales predicted wait time upward as network congestion increases.
   * Values tuned against historical mainnet data heuristics.
   */
  congestionMultiplier(level: CongestionLevel): number {
    const multipliers: Record<CongestionLevel, number> = {
      [CongestionLevel.LOW]: 1.0,
      [CongestionLevel.MEDIUM]: 1.3,
      [CongestionLevel.HIGH]: 1.8,
      [CongestionLevel.CRITICAL]: 2.5,
    };
    return multipliers[level] ?? 1.0;
  }

  /** Converts a millisecond duration to a readable string. */
  formatDuration(ms: number): string {
    const seconds = Math.round(ms / 1_000);

    if (seconds < 60) return `${seconds} seconds`;

    const minutes = Math.round(seconds / 60);
    if (minutes === 1) return '1 minute';
    if (minutes < 60) return `${minutes} minutes`;

    const hours = Math.round(minutes / 60);
    return `${hours} hour${hours > 1 ? 's' : ''}`;
  }
}
