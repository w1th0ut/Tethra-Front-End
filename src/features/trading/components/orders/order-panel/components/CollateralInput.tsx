import React from 'react';
import { Button } from '@/components/ui/button';
import { formatPrice } from '../utils/formatUtils';
import Image from 'next/image';

interface CollateralInputProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  balance: string | number;
  isLoadingBalance?: boolean;
  onMaxClick: () => void;
  label?: string;
  disabled?: boolean;
  tokenSymbol?: string;
  tokenIcon?: string;
}

export const CollateralInput: React.FC<CollateralInputProps> = ({
  value,
  onChange,
  balance,
  isLoadingBalance = false,
  onMaxClick,
  label = 'Collateral',
  disabled = false,
  tokenSymbol = 'USDC',
  tokenIcon = '/icons/usdc.png',
}) => {
  const usdValue = value ? parseFloat(value) : 0;

  return (
    <div
      className={`bg-trading-surface border border-border-default rounded-lg p-3 ${
        disabled ? 'opacity-50 pointer-events-none' : ''
      }`}
    >
      {label && <label className="text-xs text-text-secondary mb-2 block">{label}</label>}
      <div className="flex justify-between items-center mb-2">
        <input
          type="text"
          placeholder="0.0"
          value={value}
          onChange={onChange}
          disabled={disabled}
          className="bg-transparent text-2xl text-text-primary outline-none w-full disabled:cursor-not-allowed placeholder-text-muted"
        />
        <div className="flex items-center gap-2 mr-0 sm:mr-6">
          <Image
            src={tokenIcon}
            alt={tokenSymbol}
            width={28}
            height={28}
            className="rounded-full"
            onError={(e) => {
              const target = e.currentTarget;
              target.style.display = 'none';
            }}
          />
          <span className="font-medium text-text-primary">{tokenSymbol}</span>
        </div>
      </div>
      <div className="flex justify-between items-center text-xs">
        <span className="text-text-muted">{formatPrice(usdValue)}</span>
        <div className="flex items-center gap-2">
          <span className="text-text-muted">
            {isLoadingBalance ? 'Loading...' : `${balance} ${tokenSymbol}`}
          </span>
          <Button
            onClick={onMaxClick}
            disabled={disabled}
            size="sm"
            className="h-6 px-2 text-xs text-white"
          >
            Max
          </Button>
        </div>
      </div>
    </div>
  );
};
