import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { 
  Transaction, 
  Merchant, 
  Chain, 
  AnalysisResult 
} from './entities';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('DATABASE_HOST', 'localhost'),
        port: configService.get('DATABASE_PORT', 5432),
        username: configService.get('DATABASE_USERNAME', 'postgres'),
        password: configService.get('DATABASE_PASSWORD', 'postgres'),
        database: configService.get('DATABASE_NAME', 'gasguard'),
        entities: [Transaction, Merchant, Chain, AnalysisResult],
        synchronize: configService.get('DATABASE_SYNCHRONIZE', false), // Should be false in production
        logging: configService.get('DATABASE_LOGGING', false),
        maxQueryExecutionTime: 1000, // Log queries taking longer than 1 second
        ssl: configService.get('DATABASE_SSL', false),
      }),
      inject: [ConfigService],
    }),
    TypeOrmModule.forFeature([Transaction, Merchant, Chain, AnalysisResult]),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}