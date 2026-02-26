import { Controller, Get, Query, HttpCode, HttpStatus } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { GasFeeRecommendationService } from './gas-fee-recommendation.service';
import { GetGasFeeRecommendationDto } from './dto/get-gas-fee-recommendation.dto';
import { GasFeeRecommendationResponseDto } from './dto/gas-fee-recommendation-response.dto';

@ApiTags('Gas Fee Recommendations')
@Controller('gas-fees')
export class GasFeeRecommendationController {
  constructor(private readonly gasFeeService: GasFeeRecommendationService) {}

  /**
   * GET /gas-fees/recommendations
   *
   * Returns tiered EIP-1559 gas fee recommendations (Low / Medium / High)
   * with ETA predictions for the requested chain.
   */
  @Get('recommendations')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get tiered gas fee recommendations',
    description:
      'Returns EIP-1559 maxFeePerGas / maxPriorityFeePerGas for Low, Medium, and High tiers ' +
      'with deterministic ETA predictions backed by real-time mempool heuristics.',
  })
  @ApiQuery({
    name: 'chainId',
    required: false,
    type: Number,
    example: 1,
    description: 'EVM chain ID (default: 1)',
  })
  @ApiResponse({
    status: 200,
    description: 'Tiered gas fee recommendations',
    type: GasFeeRecommendationResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid query parameters' })
  @ApiResponse({ status: 503, description: 'Upstream mempool provider unavailable' })
  async getRecommendations(
    @Query() query: GetGasFeeRecommendationDto,
  ): Promise<GasFeeRecommendationResponseDto> {
    const chainId = query.chainId ?? 1;
    return this.gasFeeService.getRecommendations(chainId);
  }
}
