import { IsInt, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class GetGasFeeRecommendationDto {
  @ApiPropertyOptional({
    description: 'EVM chain ID (default: 1 for Ethereum mainnet)',
    example: 1,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  chainId?: number = 1;
}
