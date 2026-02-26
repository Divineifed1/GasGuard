import { Test, TestingModule } from '@nestjs/testing';
import { GasFeeRecommendationService } from '../src/gas-fee-recommendation.service';
import { MempoolProviderService } from '../src/mempool-provider.service';
import { EtaPredictionService } from '../src/eta-prediction.service';
import { CongestionLevel, MempoolSnapshot } from '../src/interfaces/gas-fee.interfaces';

// ── shared fixture ─────────────────────────────────────────────────────────────

const defaultSnapshot: MempoolSnapshot = {
  baseFeeGwei: 32,
  pendingTxCount: 8_500,
  recentBlockTimes: Array(10).fill(12_000),
  recentInclusionRates: { low: 0.6, medium: 0.9, high: 0.99 },
  p25PriorityFee: 1.5,
  p50PriorityFee: 2.0,
  p75PriorityFee: 3.0,
  congestionLevel: CongestionLevel.MEDIUM,
};

// ── helpers ────────────────────────────────────────────────────────────────────

function gweiValue(str: string): number {
  return parseFloat(str.replace(' gwei', ''));
}

// ── suite ──────────────────────────────────────────────────────────────────────

describe('GasFeeRecommendationService', () => {
  let service: GasFeeRecommendationService;
  let mempoolProvider: jest.Mocked<MempoolProviderService>;
  let etaPrediction: EtaPredictionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GasFeeRecommendationService,
        {
          provide: MempoolProviderService,
          useValue: {
            getSnapshot: jest.fn().mockResolvedValue(defaultSnapshot),
          },
        },
        EtaPredictionService,
      ],
    }).compile();

    service = module.get<GasFeeRecommendationService>(GasFeeRecommendationService);
    mempoolProvider = module.get(MempoolProviderService);
    etaPrediction = module.get<EtaPredictionService>(EtaPredictionService);
  });

  // ── response shape ──────────────────────────────────────────────────────────

  describe('getRecommendations() – response shape', () => {
    it('returns the correct chainId', async () => {
      const result = await service.getRecommendations(1);
      expect(result.chainId).toBe(1);
    });

    it('returns baseFee as a gwei string', async () => {
      const result = await service.getRecommendations(1);
      expect(result.baseFee).toMatch(/^\d+(\.\d+)? gwei$/);
    });

    it('returns a valid ISO timestamp', async () => {
      const result = await service.getRecommendations(1);
      expect(() => new Date(result.timestamp)).not.toThrow();
      expect(new Date(result.timestamp).toISOString()).toBe(result.timestamp);
    });

    it('includes low, medium, and high recommendation tiers', async () => {
      const { recommendations } = await service.getRecommendations(1);
      expect(recommendations).toHaveProperty('low');
      expect(recommendations).toHaveProperty('medium');
      expect(recommendations).toHaveProperty('high');
    });

    it('each tier has the required EIP-1559 fields', async () => {
      const { recommendations } = await service.getRecommendations(1);
      for (const tier of [recommendations.low, recommendations.medium, recommendations.high]) {
        expect(tier).toHaveProperty('maxFeePerGas');
        expect(tier).toHaveProperty('maxPriorityFeePerGas');
        expect(tier).toHaveProperty('estimatedConfirmationTime');
        expect(tier).toHaveProperty('confidenceScore');
      }
    });
  });

  // ── EIP-1559 fee ordering ────────────────────────────────────────────────────

  describe('getRecommendations() – fee ordering invariants', () => {
    it('high maxFeePerGas >= medium >= low', async () => {
      const { recommendations } = await service.getRecommendations(1);
      const low = gweiValue(recommendations.low.maxFeePerGas);
      const med = gweiValue(recommendations.medium.maxFeePerGas);
      const high = gweiValue(recommendations.high.maxFeePerGas);
      expect(high).toBeGreaterThanOrEqual(med);
      expect(med).toBeGreaterThanOrEqual(low);
    });

    it('high maxPriorityFeePerGas >= medium >= low', async () => {
      const { recommendations } = await service.getRecommendations(1);
      const low = gweiValue(recommendations.low.maxPriorityFeePerGas);
      const med = gweiValue(recommendations.medium.maxPriorityFeePerGas);
      const high = gweiValue(recommendations.high.maxPriorityFeePerGas);
      expect(high).toBeGreaterThanOrEqual(med);
      expect(med).toBeGreaterThanOrEqual(low);
    });

    it('maxFeePerGas is always >= baseFee for every tier', async () => {
      const result = await service.getRecommendations(1);
      const base = gweiValue(result.baseFee);
      for (const tier of Object.values(result.recommendations)) {
        expect(gweiValue(tier.maxFeePerGas)).toBeGreaterThanOrEqual(base);
      }
    });

    it('maxFeePerGas >= maxPriorityFeePerGas for every tier', async () => {
      const { recommendations } = await service.getRecommendations(1);
      for (const tier of Object.values(recommendations)) {
        expect(gweiValue(tier.maxFeePerGas)).toBeGreaterThanOrEqual(
          gweiValue(tier.maxPriorityFeePerGas),
        );
      }
    });
  });

  // ── confidence score ────────────────────────────────────────────────────────

  describe('getRecommendations() – confidence scores', () => {
    it('confidence scores are between 0 and 1 (exclusive of 1)', async () => {
      const { recommendations } = await service.getRecommendations(1);
      for (const tier of Object.values(recommendations)) {
        expect(tier.confidenceScore).toBeGreaterThan(0);
        expect(tier.confidenceScore).toBeLessThan(1);
      }
    });

    it('high tier confidence >= medium >= low', async () => {
      const { recommendations } = await service.getRecommendations(1);
      expect(recommendations.high.confidenceScore).toBeGreaterThanOrEqual(
        recommendations.medium.confidenceScore!,
      );
      expect(recommendations.medium.confidenceScore).toBeGreaterThanOrEqual(
        recommendations.low.confidenceScore!,
      );
    });
  });

  // ── congestion multiplier on priority fee ───────────────────────────────────

  describe('getRecommendations() – congestion-adjusted HIGH tip', () => {
    it('high-tier priority fee is bumped under HIGH congestion', async () => {
      const highCongestion: MempoolSnapshot = {
        ...defaultSnapshot,
        congestionLevel: CongestionLevel.HIGH,
      };
      mempoolProvider.getSnapshot.mockResolvedValueOnce(highCongestion);
      const result = await service.getRecommendations(1);

      // p75 * 1.1 = 3.3 → rounded  → should be > 3.0
      const highTip = gweiValue(result.recommendations.high.maxPriorityFeePerGas);
      expect(highTip).toBeGreaterThan(defaultSnapshot.p75PriorityFee);
    });

    it('high-tier priority fee is NOT bumped under MEDIUM congestion', async () => {
      const result = await service.getRecommendations(1); // default snapshot → MEDIUM
      const highTip = gweiValue(result.recommendations.high.maxPriorityFeePerGas);
      expect(highTip).toBe(defaultSnapshot.p75PriorityFee);
    });
  });

  // ── multi-chain ─────────────────────────────────────────────────────────────

  describe('getRecommendations() – multi-chain', () => {
    it('passes the requested chainId to the mempool provider', async () => {
      await service.getRecommendations(137); // Polygon
      expect(mempoolProvider.getSnapshot).toHaveBeenCalledWith(137);
    });

    it('reflects the chainId in the response', async () => {
      const result = await service.getRecommendations(137);
      expect(result.chainId).toBe(137);
    });
  });

  // ── mempool provider error propagation ──────────────────────────────────────

  describe('getRecommendations() – error handling', () => {
    it('propagates upstream errors from the mempool provider', async () => {
      mempoolProvider.getSnapshot.mockRejectedValueOnce(new Error('RPC timeout'));
      await expect(service.getRecommendations(1)).rejects.toThrow('RPC timeout');
    });
  });

  // ── ETA delegation ───────────────────────────────────────────────────────────

  describe('getRecommendations() – ETA delegation', () => {
    it('populates estimatedConfirmationTime from EtaPredictionService', async () => {
      jest.spyOn(etaPrediction, 'predict').mockReturnValue('custom-eta');
      const { recommendations } = await service.getRecommendations(1);
      expect(recommendations.low.estimatedConfirmationTime).toBe('custom-eta');
      expect(recommendations.medium.estimatedConfirmationTime).toBe('custom-eta');
      expect(recommendations.high.estimatedConfirmationTime).toBe('custom-eta');
    });
  });
});
