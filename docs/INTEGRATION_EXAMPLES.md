/**
 * Integration Example: Dynamic Gas Estimation with Optimization Engine
 *
 * This file demonstrates how to integrate the new dynamic gas estimation
 * engine with GasGuard's existing optimization module.
 */

import { Injectable, Logger } from '@nestjs/common';
import { DynamicPricingService } from '../gas-estimation/services/dynamic-pricing.service';
import { GasPriceHistoryService } from '../gas-estimation/services/gas-price-history.service';
import { OptimizationSuggestionDto } from '../optimization/services/optimization-engine.service';

/**
 * Example 1: Enhanced Cost Optimization with Dynamic Pricing
 *
 * Compare costs across chains using real-time, dynamic gas prices
 * instead of hardcoded assumptions
 */
@Injectable()
export class DynamicOptimizationService {
  private readonly logger = new Logger(DynamicOptimizationService.name);

  constructor(
    private dynamicPricing: DynamicPricingService,
    private gasPriceHistory: GasPriceHistoryService,
  ) {}

  /**
   * Generate chain-switch recommendations with accurate dynamic pricing
   *
   * OLD: Assumed gas prices are always 1000 stroops
   * NEW: Uses real network conditions for each chain
   */
  async recommendCheapestChain(
    chains: string[],
    estimatedGasUnits: number,
  ): Promise<{
    cheapestChain: string;
    savings: number;
    breakdown: Array<{
      chain: string;
      estimatedCostXLM: number;
      dynamicGasPrice: number;
      congestionLevel: number;
    }>;
  }> {
    this.logger.log(
      `Analyzing costs for ${chains.length} chains with ${estimatedGasUnits} gas units`,
    );

    // Get dynamic estimates for all chains
    const estimates = await Promise.all(
      chains.map(async (chainId) => {
        try {
          const estimate = await this.dynamicPricing.estimateGasPrice(
            chainId,
            estimatedGasUnits,
            'normal',
          );

          return {
            chain: chainId,
            estimatedCostXLM: estimate.totalEstimatedCostXLM,
            dynamicGasPrice: estimate.dynamicGasPrice,
            congestionLevel: estimate.alternativePrices ? 50 : 35, // placeholder
          };
        } catch (error) {
          this.logger.error(`Failed to estimate price for ${chainId}`, error);
          return null;
        }
      }),
    );

    // Filter out failed estimates
    const validEstimates = estimates.filter((e) => e !== null);

    if (validEstimates.length === 0) {
      throw new Error('Failed to estimate prices for any chain');
    }

    // Find cheapest
    const sorted = validEstimates.sort((a, b) => a.estimatedCostXLM - b.estimatedCostXLM);
    const cheapest = sorted[0];
    const mostExpensive = sorted[sorted.length - 1];

    const savings = mostExpensive.estimatedCostXLM - cheapest.estimatedCostXLM;

    return {
      cheapestChain: cheapest.chain,
      savings,
      breakdown: validEstimates,
    };
  }

  /**
   * Suggest batching opportunities based on dynamic pricing
   *
   * Identifies when batching transactions saves the most money
   * by comparing individual vs. batched costs in current prices
   */
  async suggestBatchingOpportunities(
    chainId: string,
    individualTxGasUnits: number[],
  ): Promise<{
    recommendation: string;
    savings: number;
    details: {
      individualTxsCost: number;
      batchedCost: number;
      savingsPercent: number;
    };
  }> {
    // Get price for individual transactions
    const individualEstimates = await Promise.all(
      individualTxGasUnits.map((gasUnits) =>
        this.dynamicPricing.estimateGasPrice(chainId, gasUnits, 'normal'),
      ),
    );

    const individualTotalCost = individualEstimates.reduce(
      (sum, est) => sum + est.totalEstimatedCostXLM,
      0,
    );

    // Calculate batched cost (sum of gas, single transaction overhead)
    const totalGas = individualTxGasUnits.reduce((a, b) => a + b, 0);
    const batchedEstimate = await this.dynamicPricing.estimateGasPrice(
      chainId,
      totalGas,
      'normal',
    );

    const savings = individualTotalCost - batchedEstimate.totalEstimatedCostXLM;
    const savingsPercent = (savings / individualTotalCost) * 100;

    return {
      recommendation:
        savingsPercent > 10
          ? `🎯 Batch these transactions! Save ${savingsPercent.toFixed(1)}% on gas costs`
          : `Current gas prices don't favor batching (only ${savingsPercent.toFixed(1)}% savings)`,
      savings,
      details: {
        individualTxsCost: individualTotalCost,
        batchedCost: batchedEstimate.totalEstimatedCostXLM,
        savingsPercent,
      },
    };
  }

  /**
   * Find optimal execution time for non-urgent transactions
   *
   * Analyzes historical patterns to recommend when gas prices are lowest
   */
  async suggestOptimalExecutionTime(
    chainId: string,
    gasUnits: number,
  ): Promise<{
    recommendedWindowUTC: string;
    estimatedSavings: number;
    analysis: string;
  }> {
    const timeWindows = await this.gasPriceHistory.getBestTimeWindowsForLowPrices(
      chainId,
      3,
    );

    if (timeWindows.length === 0) {
      return {
        recommendedWindowUTC: 'No data yet - execute at any time',
        estimatedSavings: 0,
        analysis: 'Not enough historical data to identify patterns',
      };
    }

    const bestWindow = timeWindows[0];
    const averagePrice =
      (await this.gasPriceHistory.getAveragePriceOverPeriod(chainId, 24)).average;

    const currentEstimate = await this.dynamicPricing.estimateGasPrice(
      chainId,
      gasUnits,
      'normal',
    );

    const optimalEstimate = bestWindow.averagePrice * gasUnits * 1.15; // with safety margin
    const savings = currentEstimate.totalEstimatedCostXLM * (1 - optimalEstimate / currentEstimate.totalEstimatedCostStroops);

    return {
      recommendedWindowUTC: `${bestWindow.hour}:00 UTC (${bestWindow.frequency} occurrences in 7 days)`,
      estimatedSavings: Math.max(0, savings),
      analysis: `Average price: ${averagePrice.toFixed(0)} stroops. Best hour: ${bestWindow.hour}:00 averaging ${bestWindow.averagePrice.toFixed(0)} stroops.`,
    };
  }

  /**
   * Detect anomalies in gas pricing (potential market manipulation or attacks)
   */
  async detectPriceAnomalies(
    chainId: string,
    windowHours: number = 6,
  ): Promise<{
    isAnomaly: boolean;
    severity: 'low' | 'medium' | 'high' | 'critical';
    details: string;
  }> {
    const stats = await this.gasPriceHistory.getAveragePriceOverPeriod(chainId, windowHours);
    const trend = await this.gasPriceHistory.getPriceTrend(chainId, windowHours);

    const current = await this.dynamicPricing.estimateGasPrice(chainId, 100000, 'normal');

    // Check if current price is outside 2 standard deviations
    const zScore = Math.abs((current.baseGasPrice - stats.average) / (stats.stdDev || 1));

    if (zScore > 3) {
      return {
        isAnomaly: true,
        severity: zScore > 5 ? 'critical' : 'high',
        details: `Current price (${current.baseGasPrice}) is ${zScore.toFixed(1)}σ from average (${stats.average.toFixed(0)}). ${trend.percentChange > 50 ? 'Sharp increase detected.' : ''}`,
      };
    }

    return {
      isAnomaly: false,
      severity: 'low',
      details: `Prices normal within expected range. Average: ${stats.average.toFixed(0)}, Current: ${current.baseGasPrice.toFixed(0)}`,
    };
  }
}

/**
 * Example 2: Export Optimization Suggestions with Dynamic Costs
 *
 * When merchants export gas optimization reports, include
 * dynamic pricing data for credibility and accuracy
 */
export interface OptimizationReportWithDynamicPricing {
  merchantId: string;
  reportDate: Date;
  suggestions: OptimizationSuggestionDto[];
  pricingContext: {
    chainAnalyzed: string;
    currentNetworkLoad: number;
    currentGasPrice: number;
    priceConfidence: number;
    priceValidUntil: Date;
    historicalContext: {
      average24h: number;
      min24h: number;
      max24h: number;
      trend: string;
    };
  };
}

/**
 * Example 3: Real-time Cost Dashboard
 *
 * Shows merchants current costs without static assumptions
 */
@Injectable()
export class RealtimeCostDashboardService {
  constructor(
    private dynamicPricing: DynamicPricingService,
    private gasPriceHistory: GasPriceHistoryService,
  ) {}

  async generateDashboard(merchantId: string, timeWindowMinutes: number = 60) {
    // In production, fetch merchant's chains from database
    const chains = ['soroban-mainnet', 'soroban-testnet'];

    const dashboardData = await Promise.all(
      chains.map(async (chainId) => {
        const current = await this.dynamicPricing.estimateGasPrice(
          chainId,
          100000,
          'normal',
        );

        const stats = await this.gasPriceHistory.getAveragePriceOverPeriod(
          chainId,
          timeWindowMinutes / 60,
        );

        return {
          chain: chainId,
          current: {
            basePrice: current.baseGasPrice,
            dynamicPrice: current.dynamicGasPrice,
            confidence: current.priceConfidence || 75,
          },
          recent: {
            average: stats.average,
            min: stats.min,
            max: stats.max,
            volatility: stats.stdDev,
          },
          estimate100kGas: {
            cost: current.totalEstimatedCostXLM,
            currency: 'XLM',
            validUntil: current.expiresAt,
          },
        };
      }),
    );

    return {
      merchantId,
      timestamp: new Date(),
      timeWindowMinutes,
      chains: dashboardData,
      recommendation: this.generateDashboardRecommendation(dashboardData),
    };
  }

  private generateDashboardRecommendation(dashboardData: any[]): string {
    const cheapest = dashboardData.reduce((prev, current) =>
      current.current.dynamicPrice < prev.current.dynamicPrice ? current : prev,
    );

    const expensive = dashboardData.reduce((prev, current) =>
      current.current.dynamicPrice > prev.current.dynamicPrice ? current : prev,
    );

    const savings =
      (expensive.estimate100kGas.cost - cheapest.estimate100kGas.cost) *
      10000; // Estimate annual

    return `Use ${cheapest.chain} to save ~${savings.toFixed(2)} XLM annually on gas costs`;
  }
}

/**
 * Example 4: Alert Users to Price Changes
 *
 * Notify users when gas prices spike or drop significantly
 */
@Injectable()
export class GasPriceAlertService {
  private priceAlerts: Map<string, number> = new Map(); // chainId -> lastNotifiedPrice

  constructor(
    private dynamicPricing: DynamicPricingService,
    private gasPriceHistory: GasPriceHistoryService,
  ) {}

  async checkForPriceAlerts(chainId: string): Promise<string | null> {
    const current = await this.dynamicPricing.estimateGasPrice(chainId, 100000, 'normal');
    const lastNotified = this.priceAlerts.get(chainId) || current.baseGasPrice;

    const percentChange = ((current.baseGasPrice - lastNotified) / lastNotified) * 100;

    let alert: string | null = null;

    if (percentChange > 50) {
      alert = `⚠️  ${chainId}: Gas prices surged ${percentChange.toFixed(0)}%! Current: ${current.baseGasPrice} stroops`;
      this.priceAlerts.set(chainId, current.baseGasPrice);
    } else if (percentChange < -30 && lastNotified > current.baseGasPrice) {
      alert = `✅ ${chainId}: Gas prices dropped ${Math.abs(percentChange).toFixed(0)}%! Current: ${current.baseGasPrice} stroops`;
      this.priceAlerts.set(chainId, current.baseGasPrice);
    }

    return alert;
  }
}
