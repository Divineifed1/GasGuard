import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { PerformanceMetricService } from '../services/performance-metric.service';

export interface ApiRequest extends Request {
  requestId?: string;
  startTime?: number;
}

@Injectable()
export class PerformanceLoggingMiddleware implements NestMiddleware {
  private readonly logger = new Logger(PerformanceLoggingMiddleware.name);

  constructor(private readonly performanceMetricService: PerformanceMetricService) {}

  async use(req: ApiRequest, res: Response, next: NextFunction) {
    const requestId = req.headers['x-request-id'] as string || this.generateRequestId();
    const startTime = Date.now();
    
    req.requestId = requestId;
    req.startTime = startTime;

    // Capture response finish event
    const originalSend = res.send;
    res.send = (data: any) => {
      const duration = Date.now() - startTime;
      const statusCode = res.statusCode;
      
      // Log performance metric asynchronously
      this.logPerformance({
        method: req.method,
        path: req.path,
        statusCode,
        duration,
        requestId,
        ip: req.ip || req.connection?.remoteAddress,
        userAgent: req.headers['user-agent'],
      }).catch(err => {
        this.logger.error(`Failed to log performance metric: ${err.message}`);
      });

      return originalSend.call(res, data);
    };

    next();
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async logPerformance(data: {
    method: string;
    path: string;
    statusCode: number;
    duration: number;
    requestId: string;
    ip?: string;
    userAgent?: string;
  }): Promise<void> {
    // Determine endpoint category
    const endpoint = this.categorizeEndpoint(data.path);
    
    await this.performanceMetricService.recordMetric({
      endpoint,
      method: data.method,
      path: data.path,
      statusCode: data.statusCode,
      responseTime: data.duration,
      requestId: data.requestId,
      ip: data.ip,
      userAgent: data.userAgent,
      timestamp: new Date(),
    });
  }

  private categorizeEndpoint(path: string): string {
    // Categorize API endpoints for better aggregation
    if (path.startsWith('/api/')) {
      const parts = path.split('/');
      if (parts.length >= 3) {
        return `/api/${parts[2]}`; // /api/analysis, /api/health, etc.
      }
    }
    return path;
  }
}
