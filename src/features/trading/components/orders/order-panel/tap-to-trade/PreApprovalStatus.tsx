import React from 'react';
import { Info } from 'lucide-react';
import { useTapToTrade } from '@/features/trading/contexts/TapToTradeContext';

interface PreApprovalStatusProps {
  // Props simplified as button logic moved to TradeActionButtons
}

export const PreApprovalStatus: React.FC<PreApprovalStatusProps> = () => {
  const tapToTrade = useTapToTrade();

  // Tap to Trade Status Banner - When Active
  if (tapToTrade.isEnabled) {
    return (
      <div className="bg-info/10 border border-info/50 rounded-lg p-3">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-info rounded-full animate-pulse"></div>
          <span className="text-sm font-bold text-info">Tap to Trade Active</span>
        </div>
        <p className="text-xs text-info mt-1">Tap grid cells on chart to select orders</p>
        <div className="bg-warning/10 border border-warning/50 rounded px-2 py-1.5 mt-2 flex items-center gap-1.5">
          <Info size={12} className="text-warning flex-shrink-0" />
          <p className="text-xs text-warning-light">
            To modify settings, please press{' '}
            <span className="font-bold text-warning-light">Stop</span> first
          </p>
        </div>
      </div>
    );
  }

  return null;
};
