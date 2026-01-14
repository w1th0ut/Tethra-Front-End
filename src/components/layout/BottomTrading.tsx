'use client';

import { useState, useEffect, useCallback } from 'react';
import { useUserPositions, usePosition } from '@/hooks/data/usePositions';
import { useEmbeddedWallet } from '@/features/wallet/hooks/useEmbeddedWallet';
import { usePrice } from '@/hooks/data/usePrices';
import { useGaslessClose } from '@/features/trading/hooks/useGaslessClose';
import { formatUnits } from 'viem';
import { toast } from 'sonner';
import PendingOrdersTable from '@/features/trading/components/orders/PendingOrdersTable';
import TapToTradeOrders from '@/features/trading/components/orders/TapToTradeOrders';
import BinaryOrders from '@/features/trading/components/orders/BinaryOrders';
import { useMarket } from '@/features/trading/contexts/MarketContext';
import TPSLModal from '@/features/trading/components/modals/TPSLModal';
import { useTPSLContext } from '@/contexts/TPSLContext';
import { ALL_MARKETS } from '@/features/trading/constants/markets';
import { formatMarketPair } from '@/features/trading/lib/marketUtils';
// Component to display individual position
const PositionRow = ({
  positionId,
  onClose,
  onPositionClick,
  onTPSLClick,
  isSelected,
  onPositionLoaded,
}: {
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
}) => {
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
      <tr className="border-t border-gray-700">
        <td colSpan={9} className="px-4 py-4 text-center text-gray-400">
          Loading position #{positionId.toString()}...
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

  const pnlColor = unrealizedPnl >= 0 ? 'text-green-400' : 'text-red-400';

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
      className={`border-t border-gray-800/50 hover:bg-gray-800/30 transition-colors cursor-pointer ${
        isSelected ? 'bg-blue-300/10 border-blue-300/30' : ''
      }`}
    >
      {/* Position / Market */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <img
            src={getMarketLogo(position.symbol)}
            alt={position.symbol}
            className="w-8 h-8 rounded-full bg-slate-700"
            onError={(e) => {
              const target = e.currentTarget;
              target.onerror = null;
              target.style.visibility = 'hidden';
            }}
          />
          <div className="flex flex-col">
            <span className="font-semibold text-white">{formatMarketPair(position.symbol)}</span>
            <div className="flex items-center gap-1">
              <span
                className={`text-xs font-medium ${
                  position.isLong ? 'text-green-400' : 'text-red-400'
                }`}
              >
                {leverage.toFixed(2)}x
              </span>
              <span
                className={`text-xs font-medium ${
                  position.isLong ? 'text-green-400' : 'text-red-400'
                }`}
              >
                {position.isLong ? 'Long' : 'Short'}
              </span>
            </div>
          </div>
        </div>
      </td>

      {/* Size */}
      <td className="px-4 py-3">
        <span className="text-white font-medium">${size.toFixed(2)}</span>
      </td>

      {/* Net Value */}
      <td className="px-4 py-3">
        <div className="flex flex-col">
          <span className={`font-medium ${pnlColor}`}>${netValue.toFixed(2)}</span>
          {currentPrice && (
            <span className={`text-xs ${pnlColor}`}>
              {unrealizedPnl >= 0 ? '+' : ''}${unrealizedPnl.toFixed(2)} (
              {pnlPercentage >= 0 ? '+' : ''}
              {pnlPercentage.toFixed(2)}%)
            </span>
          )}
        </div>
      </td>

      {/* Collateral */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-1">
          <span className="text-white">${collateral.toFixed(2)}</span>
        </div>
        <div className="text-xs text-gray-400">({collateral.toFixed(2)} USDC)</div>
      </td>

      {/* Entry Price */}
      <td className="px-4 py-3">
        <span className="text-white">
          $
          {entryPrice.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </span>
      </td>

      {/* Mark Price */}
      <td className="px-4 py-3">
        {loadingPrice ? (
          <span className="text-gray-400 text-sm">...</span>
        ) : (
          <span className="text-white">
            $
            {markPrice.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </span>
        )}
      </td>

      {/* Liquidation Price */}
      <td className="px-4 py-3">
        <span className="text-white">
          $
          {liquidationPrice.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </span>
      </td>

      {/* TP/SL Status */}
      <td className="px-4 py-3">
        {tpslConfig ? (
          <div className="flex flex-col gap-1 text-xs">
            {tpslConfig.takeProfit && (
              <div className="text-green-400">
                TP: ${(parseFloat(tpslConfig.takeProfit) / 100000000).toFixed(2)}
              </div>
            )}
            {tpslConfig.stopLoss && (
              <div className="text-red-400">
                SL: ${(parseFloat(tpslConfig.stopLoss) / 100000000).toFixed(2)}
              </div>
            )}
          </div>
        ) : (
          <span className="text-gray-500 text-xs">-</span>
        )}
      </td>

      {/* Actions */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <button
            onClick={handleTPSLClick}
            className="px-3 py-1.5 bg-blue-300/20 hover:bg-blue-300/30 text-blue-300 text-xs font-medium rounded transition-colors cursor-pointer"
          >
            TP/SL
          </button>
          <button
            onClick={() => onClose(position.id, position.symbol)}
            className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 text-xs font-medium rounded transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </td>
    </tr>
  );
};

const BottomTrading = () => {
  const [activeTab, setActiveTab] = useState('Positions');
  const [orderSubTab, setOrderSubTab] = useState('Pending Orders');
  const [openPositionsCount, setOpenPositionsCount] = useState(0);
  const { positionIds, isLoading: isLoadingIds, refetch: refetchPositions } = useUserPositions();
  const { address } = useEmbeddedWallet();
  const { closePosition, isPending: isClosing, txHash } = useGaslessClose();
  const {
    setActiveMarket,
    setSelectedPosition,
    selectedPosition,
    chartPositions,
    setChartPositions,
  } = useMarket();

  // TP/SL Modal state
  const [tpslModalOpen, setTpslModalOpen] = useState(false);
  const [tpslModalData, setTpslModalData] = useState<{
    positionId: number;
    trader: string;
    symbol: string;
    entryPrice: number;
    isLong: boolean;
  } | null>(null);
  const [tpslRefreshTrigger, setTpslRefreshTrigger] = useState(0);

  // Map to store position statuses
  const [positionStatuses, setPositionStatuses] = useState<Map<bigint, boolean>>(new Map());

  // Update open positions count when statuses change
  useEffect(() => {
    const count = Array.from(positionStatuses.values()).filter((isOpen) => isOpen).length;
    setOpenPositionsCount(count);
  }, [positionStatuses]);

  const handleClosePosition = async (positionId: bigint, symbol: string) => {
    if (!confirm(`Are you sure you want to close position #${positionId}?`)) return;
    try {
      await closePosition({ positionId, symbol });
      setTimeout(() => refetchPositions?.(), 1000);
    } catch (error) {}
  };

  const handlePositionClick = (
    positionId: bigint,
    symbol: string,
    entryPrice: number,
    isLong: boolean,
  ) => {
    setSelectedPosition({ positionId, symbol, entryPrice, isLong });
  };

  const handleTPSLModalOpen = (
    positionId: bigint,
    trader: string,
    symbol: string,
    entryPrice: number,
    isLong: boolean,
  ) => {
    setTpslModalData({
      positionId: Number(positionId),
      trader,
      symbol,
      entryPrice,
      isLong,
    });
    setTpslModalOpen(true);
  };

  const handleTPSLModalClose = (refresh: boolean) => {
    setTpslModalOpen(false);
    setTpslModalData(null);
    if (refresh) {
      setTpslRefreshTrigger((prev) => prev + 1);
    }
  };

  // Handle close all positions
  const handleCloseAllPositions = async () => {
    // Filter only open positions
    const openPositions = Array.from(positionStatuses.entries())
      .filter(([_, isOpen]) => isOpen)
      .map(([id]) => id);

    if (openPositions.length === 0 || isClosing) return;

    // Find symbol for each position to close
    // Note: We need symbols to call closePosition
    // In a real implementation, we might need a batch close endpoint
    // For now, we'll just loop through them sequentially (fire and forget from frontend)

    if (!confirm(`Are you sure you want to close ALL ${openPositions.length} positions?`)) {
      return;
    }

    try {
      toast.loading(`Closing ${openPositions.length} positions...`, { id: 'close-all' });

      // We need to fetch position details to get symbols if we don't have them handy
      // But we can try to find them from the rendered rows context if we had access
      // Since we don't have easy access to symbols here without fetching each position,
      // we'll rely on the fact that the user can only see loaded positions.

      // However, PositionRow fetches data individually.
      // A better approach for "Close All" usually requires a dedicated contract function or backend endpoint.
      // Since we are using the backend relayer, we can just loop through what we know.
      // But wait, we only have IDs here in 'positionIds'.

      // For this hackathon, let's just trigger a toast saying it's processing
      // and try to close them one by one if we can get their symbols.
      // Since we don't have symbols in 'positionIds' array (it's just BigInt[]),
      // we can't easily call closePosition(id, symbol).

      // WORKAROUND: We will disable the button if we can't implement it perfectly safely right now?
      // OR better: We can modify the Close All button to be "Close All for Current Market" if we have active market?
      // OR best: Just show a "Not implemented" toast for safety if we can't get symbols.

      // WAIT! We can pass the symbol up from PositionRow using a callback?
      // Yes, let's create a map of id -> symbol

      // See 'positionSymbols' state below
    } catch (error) {}
  };

  // Map to store symbols for positions (populated by PositionRow)
  const [positionSymbols, setPositionSymbols] = useState<Map<bigint, string>>(new Map());

  const handlePositionDataLoaded = useCallback(
    (positionId: bigint, isOpen: boolean, symbol: string) => {
      setPositionStatuses((prev) => {
        // Only update if changed to avoid unnecessary re-renders
        if (prev.get(positionId) === isOpen) return prev;
        const newMap = new Map(prev);
        newMap.set(positionId, isOpen);
        return newMap;
      });
      setPositionSymbols((prev) => {
        if (prev.get(positionId) === symbol) return prev;
        const newMap = new Map(prev);
        newMap.set(positionId, symbol);
        return newMap;
      });
    },
    [],
  );

  const executeCloseAll = async () => {
    const openPositionIds = Array.from(positionStatuses.entries())
      .filter(([_, isOpen]) => isOpen)
      .map(([id]) => id);

    if (openPositionIds.length === 0) return;

    if (!confirm(`Close all ${openPositionIds.length} positions?`)) return;

    toast.loading(`Closing all positions...`, { id: 'close-all' });

    let successCount = 0;

    // Loop through and fire close requests
    for (const id of openPositionIds) {
      const symbol = positionSymbols.get(id);
      if (symbol) {
        try {
          await closePosition({ positionId: id, symbol });
          successCount++;
        } catch (e) {}
      }
    }

    toast.dismiss('close-all');
    if (successCount > 0) {
      toast.success(`Closed ${successCount} positions!`);
      setTimeout(() => refetchPositions?.(), 2000);
    }
  };

  // No need for extra state or useEffect - just use positionIds directly
  const isLoading = isLoadingIds;

  // Mobile tabs: Orders instead of 3 separate tabs
  const mobileTabs = ['Positions', 'Orders'];
  // Desktop tabs: 3 separate order tabs
  const desktopTabs = ['Positions', 'Pending Orders', 'Tap to Trade Orders', 'Binary Orders'];

  const renderContent = () => {
    switch (activeTab) {
      case 'Positions':
        if (isLoading) {
          return <div className="text-center py-16 text-gray-500">Loading positions...</div>;
        }

        if (positionIds.length === 0) {
          return (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left text-gray-400">
                <thead className="text-xs text-gray-500 uppercase">
                  <tr className="border-b border-gray-800">
                    <th className="px-4 py-3 text-left font-medium">POSITION</th>
                    <th className="px-4 py-3 text-left font-medium">SIZE</th>
                    <th className="px-4 py-3 text-left font-medium">NET VALUE</th>
                    <th className="px-4 py-3 text-left font-medium">COLLATERAL</th>
                    <th className="px-4 py-3 text-left font-medium">ENTRY PRICE</th>
                    <th className="px-4 py-3 text-left font-medium">MARK PRICE</th>
                    <th className="px-4 py-3 text-left font-medium">LIQ. PRICE</th>
                    <th className="px-4 py-3 text-left font-medium">TP / SL</th>
                    <th className="px-4 py-3 text-left font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-gray-700">
                    <td colSpan={9} className="text-center py-16 text-gray-500">
                      No open positions
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          );
        }

        return (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-gray-400">
              <thead className="text-xs text-gray-500 uppercase">
                <tr className="border-b border-gray-800">
                  <th className="px-4 py-3 text-left font-medium">POSITION</th>
                  <th className="px-4 py-3 text-left font-medium">SIZE</th>
                  <th className="px-4 py-3 text-left font-medium">NET VALUE</th>
                  <th className="px-4 py-3 text-left font-medium">COLLATERAL</th>
                  <th className="px-4 py-3 text-left font-medium">ENTRY PRICE</th>
                  <th className="px-4 py-3 text-left font-medium">MARK PRICE</th>
                  <th className="px-4 py-3 text-left font-medium">LIQ. PRICE</th>
                  <th className="px-4 py-3 text-left font-medium">TP / SL</th>
                  <th className="px-4 py-3 text-left font-medium">
                    {openPositionsCount > 0 && (
                      <button
                        onClick={executeCloseAll}
                        disabled={isClosing}
                        className="px-3 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 text-xs font-bold rounded transition-colors cursor-pointer border border-red-500/30 w-full"
                      >
                        Close All
                      </button>
                    )}
                  </th>
                </tr>
              </thead>
              <tbody>
                {positionIds.map((positionId) => (
                  <PositionRow
                    key={`${positionId.toString()}-${tpslRefreshTrigger}`}
                    positionId={positionId}
                    onClose={handleClosePosition}
                    onPositionClick={handlePositionClick}
                    onTPSLClick={handleTPSLModalOpen}
                    isSelected={selectedPosition?.positionId === positionId}
                    onPositionLoaded={handlePositionDataLoaded}
                  />
                ))}
              </tbody>
            </table>
          </div>
        );
      case 'Orders':
        // Mobile only - show submenu
        return (
          <div>
            <div className="flex gap-2 p-3 border-b border-gray-800 bg-[#0F1419]">
              {['Pending Orders', 'Tap to Trade Orders', 'Binary Orders'].map((subTab) => (
                <button
                  key={subTab}
                  onClick={() => setOrderSubTab(subTab)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    orderSubTab === subTab
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                  }`}
                >
                  {subTab}
                </button>
              ))}
            </div>
            <div>
              {orderSubTab === 'Pending Orders' && <PendingOrdersTable />}
              {orderSubTab === 'Tap to Trade Orders' && <TapToTradeOrders />}
              {orderSubTab === 'Binary Orders' && <BinaryOrders />}
            </div>
          </div>
        );
      case 'Pending Orders':
        return <PendingOrdersTable />;
      case 'Tap to Trade Orders':
        return <TapToTradeOrders />;
      case 'Binary Orders':
        return <BinaryOrders />;
      case 'Trades':
        return <div className="text-center py-16 text-gray-500">No trades found</div>;
      case 'Claims':
        return <div className="text-center py-16 text-gray-500">No claims available</div>;
      default:
        return null;
    }
  };

  return (
    <>
      <div className="bg-[#0B1017] border border-gray-700/50 rounded-lg h-full flex flex-col">
        <div className="flex items-center justify-between border-b border-gray-800/50 flex-shrink-0 md:px-4">
          {/* Mobile tabs - full width divided by 4 */}
          <div className="flex w-full md:hidden">
            {mobileTabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-3.5 text-sm font-medium transition-colors duration-200 cursor-pointer relative ${
                  activeTab === tab ? 'text-white' : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                <span className="flex items-center justify-center gap-2">
                  {tab}
                  {tab === 'Positions' && openPositionsCount > 0 && (
                    <span className="bg-gray-700/50 text-white text-xs rounded px-1.5 py-0.5">
                      {openPositionsCount}
                    </span>
                  )}
                </span>
                {activeTab === tab && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-300"></div>
                )}
              </button>
            ))}
          </div>
          {/* Desktop tabs */}
          <div className="hidden md:flex space-x-6">
            {desktopTabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-3.5 text-sm font-medium transition-colors duration-200 cursor-pointer relative ${
                  activeTab === tab ? 'text-white' : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                <span className="flex items-center gap-2">
                  {tab}
                  {tab === 'Positions' && openPositionsCount > 0 && (
                    <span className="bg-gray-700/50 text-white text-xs rounded px-1.5 py-0.5">
                      {openPositionsCount}
                    </span>
                  )}
                </span>
                {activeTab === tab && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-300"></div>
                )}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-auto min-h-0">{renderContent()}</div>
      </div>

      {/* TP/SL Modal */}
      {tpslModalOpen && tpslModalData && (
        <TPSLModal
          isOpen={tpslModalOpen}
          onClose={handleTPSLModalClose}
          positionId={tpslModalData.positionId}
          trader={tpslModalData.trader}
          symbol={tpslModalData.symbol}
          entryPrice={tpslModalData.entryPrice}
          isLong={tpslModalData.isLong}
        />
      )}
    </>
  );
};

export default BottomTrading;
