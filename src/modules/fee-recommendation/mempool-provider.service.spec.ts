import { MempoolProviderService } from '../src/mempool-provider.service';
import { CongestionLevel } from '../src/interfaces/gas-fee.interfaces';

describe('MempoolProviderService', () => {
  let service: MempoolProviderService;

  beforeEach(() => {
    service = new MempoolProviderService();
  });

  // ── getSnapshot – shape ──────────────────────────────────────────────────────

  describe('getSnapshot()', () => {
    it('returns a snapshot with all required fields', async () => {
      const snapshot = await service.getSnapshot(1);

      expect(snapshot).toHaveProperty('baseFeeGwei');
      expect(snapshot).toHaveProperty('pendingTxCount');
      expect(snapshot).toHaveProperty('recentBlockTimes');
      expect(snapshot).toHaveProperty('recentInclusionRates');
      expect(snapshot).toHaveProperty('p25PriorityFee');
      expect(snapshot).toHaveProperty('p50PriorityFee');
      expect(snapshot).toHaveProperty('p75PriorityFee');
      expect(snapshot).toHaveProperty('congestionLevel');
    });

    it('baseFeeGwei is a positive number', async () => {
      const { baseFeeGwei } = await service.getSnapshot(1);
      expect(baseFeeGwei).toBeGreaterThan(0);
    });

    it('recentBlockTimes is a non-empty array', async () => {
      const { recentBlockTimes } = await service.getSnapshot(1);
      expect(Array.isArray(recentBlockTimes)).toBe(true);
      expect(recentBlockTimes.length).toBeGreaterThan(0);
    });

    it('inclusion rates are between 0 and 1', async () => {
      const { recentInclusionRates } = await service.getSnapshot(1);
      for (const rate of Object.values(recentInclusionRates)) {
        expect(rate).toBeGreaterThan(0);
        expect(rate).toBeLessThanOrEqual(1);
      }
    });

    it('priority fee percentiles are in ascending order', async () => {
      const { p25PriorityFee, p50PriorityFee, p75PriorityFee } = await service.getSnapshot(1);
      expect(p50PriorityFee).toBeGreaterThanOrEqual(p25PriorityFee);
      expect(p75PriorityFee).toBeGreaterThanOrEqual(p50PriorityFee);
    });

    it('congestionLevel is a valid CongestionLevel enum value', async () => {
      const { congestionLevel } = await service.getSnapshot(1);
      expect(Object.values(CongestionLevel)).toContain(congestionLevel);
    });

    it('accepts arbitrary chain IDs without throwing', async () => {
      await expect(service.getSnapshot(137)).resolves.toBeDefined();
      await expect(service.getSnapshot(56)).resolves.toBeDefined();
    });
  });

  // ── congestion derivation heuristic ─────────────────────────────────────────

  describe('congestion derivation (via getSnapshot)', () => {
    it('returns a snapshot', async () => {
      // The default stub returns pendingTxCount=8500, baseFee=32
      // score = 8.5 + 3.2 = 11.7 → MEDIUM
      const { congestionLevel } = await service.getSnapshot(1);
      expect(congestionLevel).toBe(CongestionLevel.MEDIUM);
    });
  });
});
