import { Module } from '@nestjs/common';
import { AnalyticsController } from './analytics.controller';
import { DatabaseAnalyticsService } from '../database/services/database-analytics.service';

@Module({
  controllers: [AnalyticsController],
  providers: [DatabaseAnalyticsService],
})
export class AnalyticsModule {}