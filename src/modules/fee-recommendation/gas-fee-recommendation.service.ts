import { Injectable, Logger } from '@nestjs/common';
import { MempoolProviderService } from './mempool-provider.service';
import { EtaPredictionService } from './eta-prediction.service';
import { GasFeeRecommendationResponse, MempoolSnapshot } from './interfaces/gas-fee.interfaces';
import { GasTier } from './enums/gas-tier.enum';

/**
 * GasFeeRecommendationService
 *
 * Orchestrates:
 *   1. Mempool snapshot retrieval
 *   2. Tiered fee calculation (EIP-1559)
 *   3. ETA prediction per tier
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Fee model (EIP-1559)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * maxPriorityFeePerGas (tip):
 *   LOW    → p25 priority fee from recent blocks
 *   MEDIUM → p50 priority fee
 *   HIGH   → p75 priority fee × congestion multiplier
 *
 * maxFeePerGas:
 *   = baseFee × baseFeeBuffer + maxPriorityFeePerGas
 *
 *   baseFeeBuffer accounts for the fact that baseFee can rise by up to 12.5 %
 *   per block.  We apply tiered buffers:
 *   LOW    → 1.05× (small buffer, willing to wait if fee spikes)
 *   MEDIUM → 1.15×
 *   HIGH   → 1.25× (willing to overpay slightly for guaranteed inclusion)
 *
 * Confidence score:
 *   Derived from the tier's inclusion rate; capped at 0.999.
 * ─────────────────────────────────────────────────────────────────────────────
 */
@Injectable()
export class GasFeeRecommendationService {
  private readonly logger = new Logger(GasFeeRecommendationService.name);

  /** Base-fee buffer multipliers per tier */
  private static readonly BASE_FEE_BUFFER: Record<GasTier, number> = {
    [GasTier.LOW]: 1.05,
    [GasTier.MEDIUM]: 1.15,
    [GasTier.HIGH]: 1.25,
  };

  constructor(
    private readonly mempoolProvider: MempoolProviderService,
    private readonly etaPrediction: EtaPredictionService,
  ) {}

  async getRecommendations(chainId: number): Promise<GasFeeRecommendationResponse> {
    const snapshot = await this.mempoolProvider.getSnapshot(chainId);
    this.logger.debug(
      `Snapshot: baseFee=${snapshot.baseFeeGwei} gwei, congestion=${snapshot.congestionLevel}`,
    );

    const recommendations = {
      low: this.buildTier(GasTier.LOW, snapshot),
      medium: this.buildTier(GasTier.MEDIUM, snapshot),
      high: this.buildTier(GasTier.HIGH, snapshot),
    };

    return {
      chainId,
      baseFee: `${snapshot.baseFeeGwei} gwei`,
      recommendations,
      timestamp: new Date().toISOString(),
    };
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private buildTier(tier: GasTier, snapshot: MempoolSnapshot) {
    const priorityFee = this.selectPriorityFee(tier, snapshot);
    const buffer = GasFeeRecommendationService.BASE_FEE_BUFFER[tier];
    const maxFee = snapshot.baseFeeGwei * buffer + priorityFee;

    const confidenceScore = Math.min(snapshot.recentInclusionRates[tier], 0.999);

    return {
      maxFeePerGas: `${this.round(maxFee)} gwei`,
      maxPriorityFeePerGas: `${this.round(priorityFee)} gwei`,
      estimatedConfirmationTime: this.etaPrediction.predict(tier, snapshot),
      confidenceScore: Math.round(confidenceScore * 1000) / 1000,
    };
  }

  private selectPriorityFee(tier: GasTier, snapshot: MempoolSnapshot): number {
    switch (tier) {
      case GasTier.LOW:
        return snapshot.p25PriorityFee;
      case GasTier.MEDIUM:
        return snapshot.p50PriorityFee;
      case GasTier.HIGH:
        // Slightly bump p75 during high congestion so the tx remains competitive
        return snapshot.congestionLevel === 'high' || snapshot.congestionLevel === 'critical'
          ? snapshot.p75PriorityFee * 1.1
          : snapshot.p75PriorityFee;
    }
  }

  /** Round to 4 significant decimal places to avoid floating-point noise */
  private round(value: number): number {
    return Math.round(value * 10_000) / 10_000;
  }
}
