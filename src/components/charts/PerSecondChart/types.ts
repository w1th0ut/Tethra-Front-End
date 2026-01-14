export interface PricePoint {
  time: number;
  price: number;
}

export interface PerSecondChartProps {
  symbol: string;
  currentPrice: number;
  betAmount?: string; // Bet amount from sidebar (optional, default 10)
  isBinaryTradingEnabled?: boolean; // Whether binary trading is enabled with session key
  tradeMode?: 'one-tap-profit' | 'open-position'; // Trade mode
  onCellClick?: (
    targetPrice: number,
    targetTime: number,
    entryPrice: number,
    entryTime: number,
  ) => void;
  isPlacingBet?: boolean;
  logoUrl?: string; // URL for the coin logo
  // Grid configuration props
  gridIntervalSeconds?: number;
  gridPriceStep?: number;
  gridAnchorPrice?: number;
  gridAnchorTime?: number;
}
