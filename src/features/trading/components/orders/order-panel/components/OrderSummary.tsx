import React from 'react';
import { formatDynamicUsd } from '@/features/trading/lib/marketUtils';
import { formatPrice } from '../utils/formatUtils';

interface OrderSummaryProps {
  oraclePrice: number;
  liquidationPrice: number | null;
  tradingFee: string;
  payAmount: string;
  leverage: number;
}

export const OrderSummary: React.FC<OrderSummaryProps> = ({
  oraclePrice,
  liquidationPrice,
  tradingFee,
  payAmount,
  leverage,
}) => {
  return (
    <div className="space-y-2 text-sm border-t border-border-muted pt-3">
      <div className="flex justify-between items-center">
        <span className="text-text-secondary">Oracle Price</span>
        <span className="text-text-primary font-medium">
          {Number.isFinite(oraclePrice) ? formatDynamicUsd(Number(oraclePrice)) : '$--'}
        </span>
      </div>
      <div className="flex justify-between items-center">
        <span className="text-text-secondary">Liquidation Price</span>
        <span className="text-text-primary font-medium">
          {liquidationPrice ? formatPrice(liquidationPrice) : '-'}
        </span>
      </div>
      <div className="flex justify-between items-center">
        <span className="text-text-secondary">Trading Fee</span>
        <span className="text-text-primary font-medium">
          {payAmount && leverage > 0 ? `$${tradingFee} (0.05%)` : '0.00%'}
        </span>
      </div>
    </div>
  );
};
