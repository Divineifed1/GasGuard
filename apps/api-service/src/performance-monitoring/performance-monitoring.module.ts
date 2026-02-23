import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApiPerformanceMetric, ApiPerformanceAggregate } from './entities/api-performance-metric.entity';
import { PerformanceMetricService } from './services/performance-metric.service';
import { PerformanceController } from './controllers/performance.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([ApiPerformanceMetric, ApiPerformanceAggregate]),
  ],
  controllers: [PerformanceController],
  providers: [PerformanceMetricService],
  exports: [PerformanceMetricService],
})
export class PerformanceMonitoringModule {}
