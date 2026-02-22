import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthModule } from './health/health.module';
import { ScannerModule } from './scanner/scanner.module';
import { AnalyzerModule } from './analyzer/analyzer.module';
import { RulesModule } from './rules/rules.module';
import { DatabaseModule } from './database/database.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { ReportsModule } from './reports/reports.module';
import { OptimizationModule } from './optimization/optimization.module';
import { GasEstimationModule } from './gas-estimation/gas-estimation.module';
import databaseConfig from './config/database.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig],
    }),
    DatabaseModule,
    HealthModule, 
    ScannerModule, 
    AnalyzerModule, 
    RulesModule,
    AnalyticsModule,
    ReportsModule,
    OptimizationModule,
    GasEstimationModule
  ],
})
export class AppModule {}
