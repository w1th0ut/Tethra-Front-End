'use client';

import React, { useEffect, useRef, useState, useMemo } from 'react';
import { useMarket } from '@/features/trading/contexts/MarketContext';
import { useTapToTrade } from '@/features/trading/contexts/TapToTradeContext';
import { Market } from '@/features/trading/types';
import { ALL_MARKETS } from '@/features/trading/constants/markets';
import { useMarketWebSocket } from '@/features/trading/hooks/useMarketWebSocket';
import TradingViewWidget from './TradingViewWidget';
import PerSecondChart from '@/features/second-chart/components/PerSecondChart';
import ChartHeader from './ChartHeader';
import { mergeMarketsWithOracle } from '@/features/trading/lib/marketUtils';
import { useOneTapProfit } from '@/features/trading/hooks/useOneTapProfitBetting';

const TradingChart: React.FC = () => {
  const {
    activeMarket: contextActiveMarket,
    setActiveMarket,
    setCurrentPrice,
    timeframe,
  } = useMarket();

  const baseMarkets = useMemo<Market[]>(() => ALL_MARKETS, []);
  const [activeSymbol, setActiveSymbol] = useState<string>(
    contextActiveMarket?.symbol || baseMarkets[0].symbol,
  );
  const [isMarketSelectorOpen, setIsMarketSelectorOpen] = useState(false);
  const triggerButtonRef = useRef<HTMLButtonElement>(null);

  const tapToTrade = useTapToTrade();
  const { placeBetWithSession, isPlacingBet } = useOneTapProfit();

  const { allPrices, marketDataMap, futuresDataMap, oraclePrices } =
    useMarketWebSocket(baseMarkets);

  const oracleSymbolsKey = useMemo(
    () =>
      Object.keys(oraclePrices || {})
        .sort()
        .join('|'),
    [oraclePrices],
  );

  const markets = useMemo(
    () => mergeMarketsWithOracle(baseMarkets, Object.keys(oraclePrices || {})),
    [baseMarkets, oracleSymbolsKey],
  );

  useEffect(() => {
    if (contextActiveMarket && contextActiveMarket.symbol !== activeSymbol) {
      setActiveSymbol(contextActiveMarket.symbol);
    }
  }, [contextActiveMarket, activeSymbol]);

  const activeMarket = useMemo(
    () => markets.find((m) => m.symbol === activeSymbol) || markets[0],
    [markets, activeSymbol],
  );

  const currentMarketData = activeMarket?.binanceSymbol
    ? marketDataMap[activeMarket.binanceSymbol]
    : null;
  const currentFuturesData = activeMarket?.binanceSymbol
    ? futuresDataMap[activeMarket.binanceSymbol]
    : null;
  const currentOraclePrice = activeMarket ? oraclePrices[activeMarket.symbol] : null;

  // Update context when market changes
  useEffect(() => {
    if (activeMarket) {
      setActiveMarket(activeMarket);
    }
  }, [activeMarket, setActiveMarket]);

  // Update context when price changes - prioritize Oracle price
  useEffect(() => {
    // Use Oracle price if available, fallback to Binance price
    if (currentOraclePrice?.price) {
      setCurrentPrice(currentOraclePrice.price.toString());
    } else if (currentMarketData?.price) {
      setCurrentPrice(currentMarketData.price);
    }
  }, [currentOraclePrice?.price, currentMarketData?.price, setCurrentPrice]);

  const handleMarketSelect = (symbol: string) => {
    const selectedMarket = markets.find((m) => m.symbol === symbol);
    if (selectedMarket) {
      setActiveSymbol(symbol);
      setActiveMarket(selectedMarket);
    }
    setIsMarketSelectorOpen(false);
  };

  // Handle tap to trade cell click
  const handleTapCellClick = (cellId: string) => {
    // Extract cellX and cellY from cellId (format: "cellX,cellY")
    const parts = cellId.split(',');
    if (parts.length === 2) {
      const cellX = parseInt(parts[0]);
      const cellY = parseInt(parts[1]);

      tapToTrade.handleCellClick(cellX, cellY);
    } else {
      console.error('❌ Invalid cellId format:', cellId);
    }
  };

  return (
    <div
      className="w-full h-full flex flex-col bg-trading-dark text-text-primary"
      style={{ borderRadius: '0.5rem' }}
    >
      {/* Header with market info and controls */}
      <div
        style={{
          flexShrink: 0,
          flexGrow: 0,
          borderTopLeftRadius: '0.5rem',
          borderTopRightRadius: '0.5rem',
          position: 'relative',
          zIndex: 10,
        }}
      >
        <ChartHeader
          activeMarket={activeMarket}
          marketData={currentMarketData}
          futuresData={currentFuturesData}
          allPrices={allPrices}
          marketDataMap={marketDataMap}
          futuresDataMap={futuresDataMap}
          oraclePrice={currentOraclePrice}
          oraclePrices={oraclePrices}
          onSymbolChangeClick={() => setIsMarketSelectorOpen(!isMarketSelectorOpen)}
          isMarketSelectorOpen={isMarketSelectorOpen}
          onClose={() => setIsMarketSelectorOpen(false)}
          markets={markets}
          onSelect={handleMarketSelect}
          triggerRef={triggerButtonRef}
        />
      </div>

      {/* Chart container */}
      <div
        className="trading-chart-container w-full"
        style={{
          flex: '1 1 auto',
          minHeight: 0,
          position: 'relative',
          zIndex: 1,
        }}
      >
        {activeMarket && (
          <>
            {tapToTrade.isEnabled && activeMarket?.binanceSymbol ? (
              <PerSecondChart
                key={`${activeMarket.symbol}-smooth-chart`}
                symbol={activeMarket.symbol}
                currentPrice={parseFloat(
                  currentOraclePrice?.price?.toString() || currentMarketData?.price || '0',
                )}
                betAmount={tapToTrade.betAmount}
                isBinaryTradingEnabled={tapToTrade.isBinaryTradingEnabled}
                isPlacingBet={isPlacingBet}
                logoUrl={activeMarket.logoUrl}
                // Pass grid props for Open Position mode
                {...(tapToTrade.tradeMode === 'open-position' && tapToTrade.gridSession
                  ? {
                      gridIntervalSeconds:
                        tapToTrade.gridSession.gridSizeX * tapToTrade.gridSession.timeframeSeconds,
                      gridPriceStep:
                        (parseFloat(tapToTrade.gridSession.referencePrice) / 100000000) *
                        (tapToTrade.gridSession.gridSizeYPercent / 10000),
                      gridAnchorPrice:
                        parseFloat(tapToTrade.gridSession.referencePrice) / 100000000,
                      gridAnchorTime: tapToTrade.gridSession.referenceTime,
                    }
                  : {})}
                onCellClick={(targetPrice, targetTime, entryPrice, entryTime) => {
                  if (tapToTrade.tradeMode === 'one-tap-profit') {
                    placeBetWithSession({
                      symbol: activeMarket.symbol,
                      betAmount: tapToTrade.betAmount || '10',
                      targetPrice: targetPrice.toString(),
                      targetTime: targetTime,
                      entryPrice: entryPrice.toString(),
                      entryTime: entryTime,
                    });
                  } else if (tapToTrade.tradeMode === 'open-position' && tapToTrade.gridSession) {
                    // Open Position mode - map click to grid cell
                    const session = tapToTrade.gridSession;
                    const refPrice = parseFloat(session.referencePrice) / 100000000;
                    const gridPriceStep = refPrice * (session.gridSizeYPercent / 10000);
                    const gridInterval = session.gridSizeX * session.timeframeSeconds;

                    // Calculate cell indices
                    // Cell Y: How many steps from reference price?
                    // Note: targetPrice corresponds to the BOTTOM of the cell in PerSecondChart logic?
                    // No, PerSecondChart logic returns CENTER of cell now?
                    // Wait, I check PerSecondChart handleMouseUp:
                    // const targetPrice = gridBottomPrice + GRID_Y_DOLLARS / 2;
                    // So targetPrice is CENTER.

                    // We need to find the integer index.
                    // cellY = (center - ref) / step
                    // This will result in X.5.
                    // So math.floor(val) should give the index if positive?
                    // Let's use the bottom price explicitly if we can, but we receive targetPrice (center).
                    // Center = ref + cellY * step + step/2
                    // Center - ref = step * (cellY + 0.5)
                    // (Center - ref) / step = cellY + 0.5
                    // cellY = round((Center - ref) / step - 0.5)

                    const priceDiff = targetPrice - refPrice;
                    const cellY = Math.round(priceDiff / gridPriceStep - 0.5);

                    // Cell X: Time steps from reference time
                    // targetTime in PerSecondChart is END of cell.
                    // targetTime = start + duration
                    // start = ref + cellX * duration
                    // targetTime = ref + (cellX + 1) * duration
                    // (targetTime - ref) / duration = cellX + 1
                    // cellX = round((targetTime - ref) / duration - 1)

                    const timeDiff = targetTime - session.referenceTime;
                    const cellX = Math.round(timeDiff / gridInterval - 1);

                    tapToTrade.handleCellClick(cellX, cellY);
                  }
                }}
              />
            ) : (
              <TradingViewWidget
                key={`${activeMarket.symbol}`}
                symbol={activeMarket.tradingViewSymbol}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default TradingChart;
