import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { TransactionsService } from "./transactions.service";
import { RecordTransactionDto } from "./dto/record-transaction.entity";
import { AlertQueryDto, MetricsQueryDto, TimeSeriesQueryDto } from "./metrics-query.dto";

@Controller("api/v1")
export class TransactionsController {
  constructor(private readonly svc: TransactionsService) {}

  /**
   * POST /api/v1/transactions
   * Record a transaction outcome.
   */
  @Post("transactions")
  @HttpCode(HttpStatus.CREATED)
  record(@Body() dto: RecordTransactionDto) {
    return this.svc.record(dto);
  }

  /**
   * GET /api/v1/metrics/:merchantId/:chainId
   * Success-rate metrics for one chain.
   * ?period=YYYY-MM  &type=transfer
   */
  @Get("metrics/:merchantId/:chainId")
  getMetrics(
    @Param("merchantId") merchantId: string,
    @Param("chainId", ParseIntPipe) chainId: number,
    @Query() query: MetricsQueryDto,
  ) {
    return this.svc.getMetrics(merchantId, chainId, query);
  }

  /**
   * GET /api/v1/metrics/:merchantId
   * Success-rate metrics across all chains for a merchant.
   */
  @Get("metrics/:merchantId")
  getMetricsAllChains(
    @Param("merchantId") merchantId: string,
    @Query() query: MetricsQueryDto,
  ) {
    return this.svc.getMetricsAllChains(merchantId, query);
  }

  /**
   * GET /api/v1/metrics/:merchantId/:chainId/series
   * Time-series breakdown.
   * ?granularity=daily|monthly  &period=YYYY-MM  &type=swap
   */
  @Get("metrics/:merchantId/:chainId/series")
  getTimeSeries(
    @Param("merchantId") merchantId: string,
    @Param("chainId", ParseIntPipe) chainId: number,
    @Query() query: TimeSeriesQueryDto,
  ) {
    return this.svc.getTimeSeries(merchantId, chainId, query);
  }

  /**
   * GET /api/v1/metrics/:merchantId/:chainId/alert
   * Threshold alert check.
   * ?threshold=95  &period=YYYY-MM
   */
  @Get("metrics/:merchantId/:chainId/alert")
  checkAlerts(
    @Param("merchantId") merchantId: string,
    @Param("chainId", ParseIntPipe) chainId: number,
    @Query() query: AlertQueryDto,
  ) {
    return this.svc.checkAlerts(merchantId, chainId, query);
  }
}
