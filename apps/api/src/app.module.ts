import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { ExampleController } from './example/example.controller';
import { FailedTransactionController } from './controllers/failed-transaction.controller';
import { CrossChainGasController } from './controllers/cross-chain-gas.controller';
import { FailedTransactionService } from './services/failed-transaction.service';
import { MitigationService } from './services/mitigation.service';
import { TransactionAnalysisService } from './services/transaction-analysis.service';
import { CrossChainGasService } from './services/cross-chain-gas.service';

@Module({
    imports: [
        // Configure rate limiting: 10 requests per 60 seconds per IP
        ThrottlerModule.forRoot([
            {
                name: 'default',
                ttl: 60000,  // 60 seconds in milliseconds
                limit: 10,   // 10 requests per TTL window
            },
        ]),
    ],
    controllers: [
        AppController,
        ExampleController,
        FailedTransactionController,
        CrossChainGasController,
        // Add your controllers here - remember to add @Version('1') decorator
    ],
    providers: [
        // Apply ThrottlerGuard globally to all routes
        {
            provide: APP_GUARD,
            useClass: ThrottlerGuard,
        },
        FailedTransactionService,
        MitigationService,
        TransactionAnalysisService,
        CrossChainGasService,
    ],
})
export class AppModule { }
