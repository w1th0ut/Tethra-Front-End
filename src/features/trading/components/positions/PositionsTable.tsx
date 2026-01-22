'use client';

import React from 'react';
import PositionRow from './PositionRow';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface PositionsTableProps {
  positionIds: bigint[];
  isLoading: boolean;
  openPositionsCount: number;
  isClosing: boolean;
  selectedPositionId?: bigint;
  tpslRefreshTrigger: number;
  onClosePosition: (positionId: bigint, symbol: string) => void;
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
  onPositionLoaded: (positionId: bigint, isOpen: boolean, symbol: string) => void;
  onCloseAll: () => void;
}

const PositionsTable = ({
  positionIds,
  isLoading,
  openPositionsCount,
  isClosing,
  selectedPositionId,
  tpslRefreshTrigger,
  onClosePosition,
  onPositionClick,
  onTPSLClick,
  onPositionLoaded,
  onCloseAll,
}: PositionsTableProps) => {
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-500">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-500 mb-4"></div>
        <span>Loading positions...</span>
      </div>
    );
  }

  if (positionIds.length === 0) {
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-[#0B1017] sticky top-0 z-10">
            <tr className="border-b border-gray-800">
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[140px]">
                Position
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Size
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Net Value
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Collateral
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Entry Price
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Mark Price
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Liq. Price
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                TP / SL
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-24"></th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={9} className="text-center py-20 text-slate-500">
                No open positions
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto custom-scrollbar">
      <table className="w-full text-sm text-left">
        <thead className="bg-[#0B1017] sticky top-0 z-10">
          <tr className="border-b border-gray-800">
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[140px]">
              Position
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Size
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Net Value
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Collateral
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Entry Price
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Mark Price
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Liq. Price
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              TP / SL
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
              {openPositionsCount > 0 && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={onCloseAll}
                  disabled={isClosing}
                  className="h-6 px-2 text-[10px] uppercase font-bold tracking-wider"
                >
                  Close All
                </Button>
              )}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-800/40">
          {positionIds.map((positionId) => (
            <PositionRow
              key={`${positionId.toString()}-${tpslRefreshTrigger}`}
              positionId={positionId}
              onClose={onClosePosition}
              onPositionClick={onPositionClick}
              onTPSLClick={onTPSLClick}
              isSelected={selectedPositionId === positionId}
              onPositionLoaded={onPositionLoaded}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default PositionsTable;
