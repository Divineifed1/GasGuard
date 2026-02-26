import { EtaPredictionService } from '../src/eta-prediction.service';
import { CongestionLevel, MempoolSnapshot } from '../src/interfaces/gas-fee.interfaces';
import { GasTier } from '../src/enums/gas-tier.enum';

const buildSnapshot = (overrides: Partial<MempoolSnapshot> = {}): MempoolSnapshot => ({
  baseFeeGwei: 32,
  pendingTxCount: 8_500,
  recentBlockTimes: Array(10).fill(12_000), // 12 s average
  recentInclusionRates: { low: 0.6, medium: 0.9, high: 0.99 },
  p25PriorityFee: 1.5,
  p50PriorityFee: 2.0,
  p75PriorityFee: 3.0,
  congestionLevel: CongestionLevel.MEDIUM,
  ...overrides,
});

describe('EtaPredictionService', () => {
  let service: EtaPredictionService;

  beforeEach(() => {
    service = new EtaPredictionService();
  });

  // ── averageBlockTime ────────────────────────────────────────────────────────

  describe('averageBlockTime()', () => {
    it('computes the arithmetic mean of block times', () => {
      expect(service.averageBlockTime([10_000, 14_000])).toBe(12_000);
    });

    it('returns the fallback of 12 000 ms for an empty array', () => {
      expect(service.averageBlockTime([])).toBe(12_000);
    });

    it('returns the single value when only one block time is provided', () => {
      expect(service.averageBlockTime([9_000])).toBe(9_000);
    });
  });

  // ── congestionMultiplier ────────────────────────────────────────────────────

  describe('congestionMultiplier()', () => {
    it('returns 1.0 for LOW congestion', () => {
      expect(service.congestionMultiplier(CongestionLevel.LOW)).toBe(1.0);
    });

    it('returns 1.3 for MEDIUM congestion', () => {
      expect(service.congestionMultiplier(CongestionLevel.MEDIUM)).toBe(1.3);
    });

    it('returns 1.8 for HIGH congestion', () => {
      expect(service.congestionMultiplier(CongestionLevel.HIGH)).toBe(1.8);
    });

    it('returns 2.5 for CRITICAL congestion', () => {
      expect(service.congestionMultiplier(CongestionLevel.CRITICAL)).toBe(2.5);
    });
  });

  // ── formatDuration ──────────────────────────────────────────────────────────

  describe('formatDuration()', () => {
    it('formats sub-60 s correctly', () => {
      expect(service.formatDuration(20_000)).toBe('20 seconds');
    });

    it('formats exactly 1 minute', () => {
      expect(service.formatDuration(60_000)).toBe('1 minute');
    });

    it('formats multiple minutes', () => {
      expect(service.formatDuration(180_000)).toBe('3 minutes');
    });

    it('formats hours for very long waits', () => {
      expect(service.formatDuration(3_600_000)).toBe('1 hour');
      expect(service.formatDuration(7_200_000)).toBe('2 hours');
    });

    it('rounds seconds to nearest integer', () => {
      expect(service.formatDuration(25_500)).toBe('26 seconds');
    });
  });

  // ── predict ─────────────────────────────────────────────────────────────────

  describe('predict()', () => {
    it('returns a non-empty string for LOW tier', () => {
      const result = service.predict(GasTier.LOW, buildSnapshot());
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('returns a non-empty string for MEDIUM tier', () => {
      expect(service.predict(GasTier.MEDIUM, buildSnapshot())).toBeTruthy();
    });

    it('returns a non-empty string for HIGH tier', () => {
      expect(service.predict(GasTier.HIGH, buildSnapshot())).toBeTruthy();
    });

    it('produces longer ETA for LOW than HIGH under the same snapshot', () => {
      const snapshot = buildSnapshot();
      const lowMs = parseDurationToMs(service.predict(GasTier.LOW, snapshot));
      const highMs = parseDurationToMs(service.predict(GasTier.HIGH, snapshot));
      expect(lowMs).toBeGreaterThanOrEqual(highMs);
    });

    it('increases ETA under CRITICAL congestion vs LOW congestion for same tier', () => {
      const lowCongestion = buildSnapshot({ congestionLevel: CongestionLevel.LOW });
      const criticalCongestion = buildSnapshot({ congestionLevel: CongestionLevel.CRITICAL });

      const etaLow = parseDurationToMs(service.predict(GasTier.MEDIUM, lowCongestion));
      const etaCritical = parseDurationToMs(service.predict(GasTier.MEDIUM, criticalCongestion));

      expect(etaCritical).toBeGreaterThan(etaLow);
    });

    it('reflects slow block times in longer ETAs', () => {
      const fast = buildSnapshot({ recentBlockTimes: Array(10).fill(6_000) });
      const slow = buildSnapshot({ recentBlockTimes: Array(10).fill(24_000) });

      const etaFast = parseDurationToMs(service.predict(GasTier.MEDIUM, fast));
      const etaSlow = parseDurationToMs(service.predict(GasTier.MEDIUM, slow));

      expect(etaSlow).toBeGreaterThan(etaFast);
    });

    it('handles 100% inclusion rate (HIGH tier) gracefully', () => {
      const snapshot = buildSnapshot({
        recentInclusionRates: { low: 0.9, medium: 0.95, high: 1.0 },
      });
      expect(() => service.predict(GasTier.HIGH, snapshot)).not.toThrow();
    });

    it('uses fallback block time when recentBlockTimes is empty', () => {
      const snapshot = buildSnapshot({ recentBlockTimes: [] });
      const result = service.predict(GasTier.MEDIUM, snapshot);
      expect(result).toBeTruthy();
    });
  });
});

// ── helpers ────────────────────────────────────────────────────────────────────

function parseDurationToMs(duration: string): number {
  const seconds = duration.match(/(\d+)\s*second/);
  if (seconds) return parseInt(seconds[1]) * 1_000;

  const minutes = duration.match(/(\d+)\s*minute/);
  if (minutes) return parseInt(minutes[1]) * 60_000;

  const hours = duration.match(/(\d+)\s*hour/);
  if (hours) return parseInt(hours[1]) * 3_600_000;

  return 0;
}
