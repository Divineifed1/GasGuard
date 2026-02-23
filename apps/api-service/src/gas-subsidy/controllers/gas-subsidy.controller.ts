import { Controller, Get, Post, Put, Param, Body, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { GasSubsidyService, SubsidyUsageRecord, CreateCapDto } from '../services/gas-subsidy.service';
import { SubsidyCapType, SubsidyStatus } from '../entities/gas-subsidy.entity';

interface CheckSubsidyDto {
  amount: number;
}

interface AcknowledgeAlertDto {
  acknowledgedBy: string;
}

@ApiTags('Gas Subsidy Management')
@Controller('api/subsidy')
export class GasSubsidyController {
  constructor(private readonly gasSubsidyService: GasSubsidyService) {}

  @Get('health')
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  health() {
    return { status: 'ok', service: 'gas-subsidy' };
  }

  @Post('caps')
  @HttpCode(HttpStatus.CREATED)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async createCap(@Body() dto: CreateCapDto) {
    const cap = await this.gasSubsidyService.createCap(dto);
    return { success: true, cap };
  }

  @Get('caps/:walletAddress')
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async getCap(
    @Param('walletAddress') walletAddress: string,
    @Query('capType') capType?: SubsidyCapType,
  ) {
    return this.gasSubsidyService.getCap(walletAddress, capType);
  }

  @Get('caps')
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async getAllCaps(@Query('status') status?: SubsidyStatus) {
    return this.gasSubsidyService.getAllCaps(status);
  }

  @Post('check/:walletAddress')
  @HttpCode(HttpStatus.OK)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async checkSubsidy(
    @Param('walletAddress') walletAddress: string,
    @Body() dto: CheckSubsidyDto,
  ) {
    return this.gasSubsidyService.checkSubsidy(walletAddress, dto.amount);
  }

  @Post('usage')
  @HttpCode(HttpStatus.CREATED)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async recordUsage(@Body() record: SubsidyUsageRecord) {
    const log = await this.gasSubsidyService.recordUsage(record);
    return { success: true, log };
  }

  @Get('usage/:walletAddress')
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async getUsageLogs(
    @Param('walletAddress') walletAddress: string,
    @Query('limit') limit?: number,
  ) {
    return this.gasSubsidyService.getUsageLogs(walletAddress, limit || 100);
  }

  @Get('alerts')
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async getAlerts(@Query('walletAddress') walletAddress?: string) {
    return this.gasSubsidyService.getActiveAlerts(walletAddress);
  }

  @Put('alerts/:alertId/acknowledge')
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async acknowledgeAlert(
    @Param('alertId') alertId: string,
    @Body() dto: AcknowledgeAlertDto,
  ) {
    const alert = await this.gasSubsidyService.acknowledgeAlert(alertId, dto.acknowledgedBy);
    return { success: true, alert };
  }

  @Get('flags')
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async getSuspiciousFlags(@Query('walletAddress') walletAddress?: string) {
    return this.gasSubsidyService.getSuspiciousFlags(walletAddress);
  }

  @Put('flags/:flagId/clear')
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async clearFlag(@Param('flagId') flagId: string) {
    const flag = await this.gasSubsidyService.clearSuspiciousFlag(flagId);
    return { success: true, flag };
  }

  @Get('realtime')
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async getRealtimeSummary() {
    return this.gasSubsidyService.getRealtimeSummary();
  }
}
