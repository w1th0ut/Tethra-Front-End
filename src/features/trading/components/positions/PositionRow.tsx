'use client';

import React, { useEffect } from 'react';
import { usePosition } from '@/hooks/data/usePositions';
import { usePrice } from '@/hooks/data/usePrices';
import { useTPSLContext } from '@/contexts/TPSLContext';
import { ALL_MARKETS } from '@/features/trading/constants/markets';
import { formatMarketPair } from '@/features/trading/lib/marketUtils';
import { formatUnits } from 'viem';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface PositionRowProps {
  positionId: bigint;
  onClose: (positionId: bigint, symbol: string) => void;
  onPositionClick: (
    positionId: bigint,
    symbol: string,
    entryPrice: number,
    isLong: boolean,
  ) => void;
  onTPSLClick: (
    positionId: bigint,
    trader: string,
    symbol: string,
    entryPrice: number,
    isLong: boolean,
  ) => void;
  isSelected: boolean;
  onPositionLoaded?: (positionId: bigint, isOpen: boolean, symbol: string) => void;
}

const PositionRow = ({
  positionId,
  onClose,
  onPositionClick,
  onTPSLClick,
  isSelected,
  onPositionLoaded,
}: PositionRowProps) => {
  const { position, isLoading } = usePosition(positionId);

  // Use shared price hook - all positions with same symbol share same price
  const { price: priceData, isLoading: loadingPrice } = usePrice(position?.symbol);
  const currentPrice = priceData?.price || null;

  // Fetch TP/SL config for this position from global context
  const { getConfig } = useTPSLContext();
  const tpslConfig = position ? getConfig(Number(position.id)) : null;

  // Report position status when loaded
  useEffect(() => {
    if (!isLoading && position && onPositionLoaded) {
      onPositionLoaded(positionId, position.status === 0, position.symbol);
    }
  }, [isLoading, position, positionId, onPositionLoaded]);

  if (isLoading) {
    return (
      <tr className="border-t border-gray-800/50">
        <td colSpan={9} className="px-4 py-4 text-center text-gray-500">
          Loading...
        </td>
      </tr>
    );
  }

  if (!position) {
    return null;
  }

  // Only show open positions
  if (position.status !== 0) {
    return null;
  }

  const entryPrice = parseFloat(formatUnits(position.entryPrice, 8));
  const collateral = parseFloat(formatUnits(position.collateral, 6));
  const size = parseFloat(formatUnits(position.size, 6));
  const leverage = Number(position.leverage);

  // Calculate unrealized PnL and net value
  let unrealizedPnl = 0;
  let pnlPercentage = 0;
  let netValue = collateral;
  const markPrice = currentPrice || entryPrice;

  if (currentPrice && entryPrice > 0) {
    const priceDiff = position.isLong ? currentPrice - entryPrice : entryPrice - currentPrice;

    unrealizedPnl = (priceDiff / entryPrice) * size;
    pnlPercentage = (unrealizedPnl / collateral) * 100;
    netValue = collateral + unrealizedPnl;
  }

  // Calculate liquidation price (simplified)
  // Liq price = entry ± (collateral / size) * entry
  // For long: entry - (collateral / size) * entry * 0.9
  // For short: entry + (collateral / size) * entry * 0.9
  const liqPriceRatio = (collateral / size) * 0.9;
  const liquidationPrice = position.isLong
    ? entryPrice * (1 - liqPriceRatio)
    : entryPrice * (1 + liqPriceRatio);

  const pnlColor = unrealizedPnl >= 0 ? 'text-emerald-400' : 'text-red-400';

  // Get crypto logo URL from ALL_MARKETS
  const getMarketLogo = (symbol: string) => {
    const market = ALL_MARKETS.find((m) => m.symbol === symbol);
    return market?.logoUrl || '';
  };

  const handleRowClick = (e: React.MouseEvent) => {
    // Don't trigger if clicking on Close button or menu
    const target = e.target as HTMLElement;
    if (target.closest('button')) {
      return;
    }
    onPositionClick(position.id, position.symbol, entryPrice, position.isLong);
  };

  // Handle TP/SL button click
  const handleTPSLClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onTPSLClick(position.id, position.trader, position.symbol, entryPrice, position.isLong);
  };

  return (
    <tr
      onClick={handleRowClick}
      className={cn(
        'border-t border-gray-800/40 hover:bg-gray-800/20 transition-colors cursor-pointer group',
        isSelected && 'bg-blue-500/5',
      )}
    >
      {/* Position / Market */}
      <td className="px-4 py-4">
        <div className="flex items-center gap-3">
          <img
            src={getMarketLogo(position.symbol)}
            alt={position.symbol}
            className="w-8 h-8 rounded-full bg-slate-800 object-cover"
            onError={(e) => {
              const target = e.currentTarget;
              target.onerror = null;
              target.style.visibility = 'hidden';
            }}
          />
          <div className="flex flex-col">
            <span className="font-bold text-slate-100">{formatMarketPair(position.symbol)}</span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-xs font-semibold text-slate-400">{leverage.toFixed(2)}x</span>
              <span
                className={cn(
                  'text-xs font-semibold px-1.5 rounded-[3px] bg-opacity-20',
                  position.isLong
                    ? 'text-emerald-400 bg-emerald-400/10'
                    : 'text-red-400 bg-red-400/10',
                )}
              >
                {position.isLong ? 'Long' : 'Short'}
              </span>
            </div>
          </div>
        </div>
      </td>

      {/* Size */}
      <td className="px-4 py-4 text-right text-slate-200 font-medium">${size.toFixed(2)}</td>

      {/* Net Value */}
      <td className="px-4 py-4 text-right text-slate-200">
        <div className="flex flex-col items-end gap-0.5">
          <span className={cn('font-semibold', pnlColor)}>${netValue.toFixed(2)}</span>
          {currentPrice && (
            <span className={cn('text-xs font-medium', pnlColor)}>
              {unrealizedPnl >= 0 ? '+' : ''}
              {unrealizedPnl.toFixed(2)} ({pnlPercentage >= 0 ? '+' : ''}
              {pnlPercentage.toFixed(2)}%)
            </span>
          )}
        </div>
      </td>

      {/* Collateral */}
      <td className="px-4 py-4 text-right">
        <div className="flex flex-col items-end gap-0.5">
          <span className="text-slate-200 font-medium">${collateral.toFixed(2)}</span>
          <span className="text-xs text-slate-500">{collateral.toFixed(2)} USDC</span>
        </div>
      </td>

      {/* Entry Price */}
      <td className="px-4 py-4 text-right text-slate-200">
        $
        {entryPrice.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}
      </td>

      {/* Mark Price */}
      <td className="px-4 py-4 text-right text-slate-200">
        {loadingPrice ? (
          <span className="text-slate-600">...</span>
        ) : (
          <>
            $
            {markPrice.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </>
        )}
      </td>

      {/* Liquidation Price */}
      <td className="px-4 py-4 text-right text-slate-200">
        $
        {liquidationPrice.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}
      </td>

      {/* TP/SL Status */}
      <td className="px-4 py-4 text-right">
        {tpslConfig ? (
          <div className="flex flex-col items-end gap-1 text-xs font-medium">
            {tpslConfig.takeProfit && (
              <span className="text-emerald-400/90">
                TP: ${(parseFloat(tpslConfig.takeProfit) / 100000000).toFixed(2)}
              </span>
            )}
            {tpslConfig.stopLoss && (
              <span className="text-red-400/90">
                SL: ${(parseFloat(tpslConfig.stopLoss) / 100000000).toFixed(2)}
              </span>
            )}
          </div>
        ) : (
          <span className="text-slate-600 text-xs">-</span>
        )}
      </td>

      {/* Actions */}
      <td className="px-4 py-4 text-right">
        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleTPSLClick}
            className="h-7 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
          >
            TP/SL
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onClose(position.id, position.symbol)}
            className="h-7 px-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 text-xs font-medium border border-red-500/20"
          >
            Close
          </Button>
        </div>
      </td>
    </tr>
  );
};

export default PositionRow;
