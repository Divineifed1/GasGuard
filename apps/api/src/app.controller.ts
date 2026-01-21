import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
    /**
     * Root endpoint - API info
     */
    @Get()
    getRoot(): { name: string; version: string; health: string } {
        return {
            name: 'GasGuard API',
            version: '0.1.0',
            health: '/health',
        };
    }

    /**
     * Health check endpoint
     * Returns a simple status to verify the API is running
     */
    @Get('health')
    getHealth(): { status: string } {
        return { status: 'ok' };
    }
}
