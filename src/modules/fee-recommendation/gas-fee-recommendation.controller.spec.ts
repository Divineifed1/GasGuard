import { Test, TestingModule } from '@nestjs/testing';
import { GasFeeRecommendationController } from '../src/gas-fee-recommendation.controller';
import { GasFeeRecommendationService } from '../src/gas-fee-recommendation.service';
import { GasFeeRecommendationResponse } from '../src/interfaces/gas-fee.interfaces';

// ── fixture ────────────────────────────────────────────────────────────────────

const mockResponse: GasFeeRecommendationResponse = {
  chainId: 1,
  baseFee: '32 gwei',
  recommendations: {
    low: {
      maxFeePerGas: '35.6 gwei',
      maxPriorityFeePerGas: '1.5 gwei',
      estimatedConfirmationTime: '3 minutes',
      confidenceScore: 0.6,
    },
    medium: {
      maxFeePerGas: '38.8 gwei',
      maxPriorityFeePerGas: '2 gwei',
      estimatedConfirmationTime: '1 minute',
      confidenceScore: 0.9,
    },
    high: {
      maxFeePerGas: '43 gwei',
      maxPriorityFeePerGas: '3 gwei',
      estimatedConfirmationTime: '16 seconds',
      confidenceScore: 0.99,
    },
  },
  timestamp: '2025-06-10T12:00:00.000Z',
};

// ── suite ──────────────────────────────────────────────────────────────────────

describe('GasFeeRecommendationController', () => {
  let controller: GasFeeRecommendationController;
  let service: jest.Mocked<GasFeeRecommendationService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [GasFeeRecommendationController],
      providers: [
        {
          provide: GasFeeRecommendationService,
          useValue: {
            getRecommendations: jest.fn().mockResolvedValue(mockResponse),
          },
        },
      ],
    }).compile();

    controller = module.get<GasFeeRecommendationController>(GasFeeRecommendationController);
    service = module.get(GasFeeRecommendationService);
  });

  // ── baseline ────────────────────────────────────────────────────────────────

  it('is defined', () => {
    expect(controller).toBeDefined();
  });

  // ── default chainId ──────────────────────────────────────────────────────────

  describe('getRecommendations() – default chainId', () => {
    it('delegates to the service with chainId=1 when no query param is supplied', async () => {
      await controller.getRecommendations({});
      expect(service.getRecommendations).toHaveBeenCalledWith(1);
    });

    it('returns the service response unchanged', async () => {
      const result = await controller.getRecommendations({});
      expect(result).toEqual(mockResponse);
    });
  });

  // ── custom chainId ───────────────────────────────────────────────────────────

  describe('getRecommendations() – custom chainId', () => {
    it('passes chainId=137 to the service when provided in query', async () => {
      await controller.getRecommendations({ chainId: 137 });
      expect(service.getRecommendations).toHaveBeenCalledWith(137);
    });

    it('passes chainId=56 (BSC) to the service', async () => {
      await controller.getRecommendations({ chainId: 56 });
      expect(service.getRecommendations).toHaveBeenCalledWith(56);
    });
  });

  // ── service delegation ───────────────────────────────────────────────────────

  describe('getRecommendations() – service delegation', () => {
    it('calls getRecommendations exactly once per request', async () => {
      await controller.getRecommendations({ chainId: 1 });
      expect(service.getRecommendations).toHaveBeenCalledTimes(1);
    });

    it('propagates service errors to the caller', async () => {
      service.getRecommendations.mockRejectedValueOnce(new Error('Chain unsupported'));
      await expect(controller.getRecommendations({ chainId: 99 })).rejects.toThrow(
        'Chain unsupported',
      );
    });
  });

  // ── response structure ────────────────────────────────────────────────────────

  describe('getRecommendations() – response structure', () => {
    it('response includes chainId, baseFee, recommendations, and timestamp', async () => {
      const result = await controller.getRecommendations({});
      expect(result).toHaveProperty('chainId');
      expect(result).toHaveProperty('baseFee');
      expect(result).toHaveProperty('recommendations');
      expect(result).toHaveProperty('timestamp');
    });

    it('recommendations include all three tiers', async () => {
      const result = await controller.getRecommendations({});
      expect(result.recommendations).toHaveProperty('low');
      expect(result.recommendations).toHaveProperty('medium');
      expect(result.recommendations).toHaveProperty('high');
    });
  });
});
