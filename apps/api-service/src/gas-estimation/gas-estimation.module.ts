import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { GasEstimationController } from './gas-estimation.controller';
import { NetworkMonitorService } from './services/network-monitor.service';
import { DynamicPricingService } from './services/dynamic-pricing.service';
import { GasPriceHistoryService } from './services/gas-price-history.service';
import { GasPriceHistory } from './entities/gas-price-history.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([GasPriceHistory]),
    ScheduleModule.forRoot(), // For scheduled network metric updates
  ],
  controllers: [GasEstimationController],
  providers: [
    NetworkMonitorService,
    DynamicPricingService,
    GasPriceHistoryService,
  ],
  exports: [
    NetworkMonitorService,
    DynamicPricingService,
    GasPriceHistoryService,
  ],
})
export class GasEstimationModule {}
