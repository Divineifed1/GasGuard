import { Module } from '@nestjs/common';
import { GasFeeRecommendationController } from './gas-fee-recommendation.controller';
import { GasFeeRecommendationService } from './gas-fee-recommendation.service';
import { MempoolProviderService } from './mempool-provider.service';
import { EtaPredictionService } from './eta-prediction.service';

@Module({
  controllers: [GasFeeRecommendationController],
  providers: [
    GasFeeRecommendationService,
    MempoolProviderService,
    EtaPredictionService,
  ],
  exports: [GasFeeRecommendationService],
})
export class GasFeeRecommendationModule {}
