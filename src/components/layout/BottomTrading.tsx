'use client';

import { useState, useEffect, useCallback } from 'react';
import { useUserPositions } from '@/hooks/data/usePositions';
import { useEmbeddedWallet } from '@/features/wallet/hooks/useEmbeddedWallet';
import { useGaslessClose } from '@/features/trading/hooks/useGaslessClose';
import { toast } from 'sonner';
import { useMarket } from '@/features/trading/contexts/MarketContext';
import TPSLModal from '@/features/trading/components/modals/TPSLModal';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import PositionsTable from '@/features/trading/components/positions/PositionsTable';
import { Button } from '@/components/ui/button';

// New Components & Hooks
import OpenOrdersTab from '@/features/trading/components/orders/OpenOrdersTab';
import OneTapProfitTab from '@/features/trading/components/orders/OneTapProfitTab';
import HistoryTab from '@/features/trading/components/orders/HistoryTab';
import { useTapToTradeOrders } from '@/features/trading/hooks/useTapToTradeOrders';
import { useUserPendingOrders } from '@/features/trading/hooks/useLimitOrder';
import { useBinaryOrders } from '@/features/trading/hooks/useBinaryOrders';

export default function BottomTrading() {
  const [openPositionsCount, setOpenPositionsCount] = useState(0);
  const { positionIds, isLoading: isLoadingIds, refetch: refetchPositions } = useUserPositions();
  const { closePosition, isPending: isClosing } = useGaslessClose();
  const { setSelectedPosition, selectedPosition } = useMarket();

  // Counts for Tabs
  const { orders: limitOrders } = useUserPendingOrders();
  const { orders: tapOrders } = useTapToTradeOrders();
  const { orders: binaryOrders } = useBinaryOrders();

  const pendingTapCount = tapOrders.filter((o) => o.status === 'PENDING').length;
  const openOrdersCount = limitOrders.length + pendingTapCount;
  const activeBinaryCount = binaryOrders.filter((o) => o.status === 'ACTIVE').length;

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

  // Map to store symbols for positions
  const [positionSymbols, setPositionSymbols] = useState<Map<bigint, string>>(new Map());

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

  const handlePositionDataLoaded = useCallback(
    (positionId: bigint, isOpen: boolean, symbol: string) => {
      setPositionStatuses((prev) => {
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

  return (
    <>
      <div className="bg-[#0B1017] rounded-lg h-full flex flex-col z-50 overflow-hidden">
        <Tabs defaultValue="positions" className="w-full h-full flex flex-col">
          <div className="flex items-center w-full border-b border-gray-800 bg-[#0B1017]">
            <TabsList className="bg-transparent h-12 w-full justify-start p-0 gap-6 px-4">
              <TabsTrigger
                value="positions"
                className="
                  data-[state=active]:bg-[#131B26]
                  data-[state=active]:shadow-none 
                  data-[state=active]:border-b-2 
                  data-[state=active]:border-b-[#3B82F6] 
                  data-[state=active]:text-white 
                  text-gray-400 
                  rounded-t-md
                  rounded-b-none 
                  h-full 
                  px-4
                  font-medium
                  hover:text-gray-300
                  hover:bg-white/5
                  transition-all
                "
              >
                <div className="flex items-center gap-2">
                  Positions
                  {openPositionsCount > 0 && (
                    <span className="flex items-center justify-center min-w-[18px] h-[18px] text-[10px] font-bold bg-[#1E293B] text-gray-300 rounded px-1">
                      {openPositionsCount}
                    </span>
                  )}
                </div>
              </TabsTrigger>
              <TabsTrigger
                value="openorders"
                className="
                  data-[state=active]:bg-[#131B26]
                  data-[state=active]:shadow-none 
                  data-[state=active]:border-b-2 
                  data-[state=active]:border-b-[#3B82F6] 
                  data-[state=active]:text-white 
                  text-gray-400 
                  rounded-t-md
                  rounded-b-none 
                  h-full 
                  px-4
                  font-medium
                  hover:text-gray-300
                  hover:bg-white/5
                  transition-all
                "
              >
                <div className="flex items-center gap-2">
                  Open Orders
                  {openOrdersCount > 0 && (
                    <span className="flex items-center justify-center min-w-[18px] h-[18px] text-[10px] font-bold bg-[#1E293B] text-gray-300 rounded px-1">
                      {openOrdersCount}
                    </span>
                  )}
                </div>
              </TabsTrigger>
              <TabsTrigger
                value="onetap"
                className="
                  data-[state=active]:bg-[#131B26]
                  data-[state=active]:shadow-none 
                  data-[state=active]:border-b-2 
                  data-[state=active]:border-b-[#3B82F6] 
                  data-[state=active]:text-white 
                  text-gray-400 
                  rounded-t-md
                  rounded-b-none 
                  h-full 
                  px-4
                  font-medium
                  hover:text-gray-300
                  hover:bg-white/5
                  transition-all
                "
              >
                <div className="flex items-center gap-2">
                  One Tap Profit
                  {activeBinaryCount > 0 && (
                    <span className="flex items-center justify-center min-w-[18px] h-[18px] text-[10px] font-bold bg-[#1E293B] text-gray-300 rounded px-1">
                      {activeBinaryCount}
                    </span>
                  )}
                </div>
              </TabsTrigger>
              <TabsTrigger
                value="history"
                className="
                  data-[state=active]:bg-[#131B26]
                  data-[state=active]:shadow-none 
                  data-[state=active]:border-b-2 
                  data-[state=active]:border-b-[#3B82F6] 
                  data-[state=active]:text-white 
                  text-gray-400 
                  rounded-t-md
                  rounded-b-none 
                  h-full 
                  px-4
                  font-medium
                  hover:text-gray-300
                  hover:bg-white/5
                  transition-all
                "
              >
                <div className="pb-3">History</div>
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-hidden relative bg-[#0B1017]">
            <TabsContent
              value="positions"
              className="h-full m-0 data-[state=inactive]:hidden flex flex-col"
            >
              <PositionsTable
                positionIds={positionIds}
                isLoading={isLoadingIds}
                openPositionsCount={openPositionsCount}
                isClosing={isClosing}
                selectedPositionId={selectedPosition?.positionId}
                tpslRefreshTrigger={tpslRefreshTrigger}
                onClosePosition={handleClosePosition}
                onPositionClick={handlePositionClick}
                onTPSLClick={handleTPSLModalOpen}
                onPositionLoaded={handlePositionDataLoaded}
                onCloseAll={executeCloseAll}
              />
            </TabsContent>

            <TabsContent
              value="openorders"
              className="h-full m-0 data-[state=inactive]:hidden overflow-auto"
            >
              <OpenOrdersTab />
            </TabsContent>

            <TabsContent
              value="onetap"
              className="h-full m-0 data-[state=inactive]:hidden overflow-auto"
            >
              <OneTapProfitTab />
            </TabsContent>

            <TabsContent
              value="history"
              className="h-full m-0 data-[state=inactive]:hidden overflow-auto"
            >
              <HistoryTab />
            </TabsContent>
          </div>
        </Tabs>
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
}
