export interface GasTierRecommendation {
  maxFeePerGas: string;
  maxPriorityFeePerGas: string;
  estimatedConfirmationTime: string;
  confidenceScore?: number;
}

export interface GasFeeRecommendationResponse {
  chainId: number;
  baseFee: string;
  recommendations: {
    low: GasTierRecommendation;
    medium: GasTierRecommendation;
    high: GasTierRecommendation;
  };
  timestamp: string;
}

export interface MempoolSnapshot {
  baseFeeGwei: number;
  pendingTxCount: number;
  recentBlockTimes: number[]; // milliseconds between recent blocks
  recentInclusionRates: {
    low: number;    // fraction of txs with low priority included
    medium: number;
    high: number;
  };
  p25PriorityFee: number; // gwei
  p50PriorityFee: number;
  p75PriorityFee: number;
  congestionLevel: CongestionLevel;
}

export enum CongestionLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}
