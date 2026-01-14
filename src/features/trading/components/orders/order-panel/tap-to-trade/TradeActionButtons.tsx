import React from 'react';
import { toast } from 'sonner';
import { ConnectedWallet } from '@privy-io/react-auth';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { Market } from '../components/MarketSelector';

interface TradeActionButtonsProps {
  tradeMode: 'open-position' | 'one-tap-profit';
  tapToTrade: any;
  activeMarket: Market | null;
  marginAmount: string;
  leverage: number;
  timeframe: string;
  currentPrice: string;
  hasLargeAllowance: boolean;
  hasLargeOneTapProfitAllowance: boolean;
  hasSelectedYGrid: boolean;
  wallets: ConnectedWallet[];

  onPreApprove: () => Promise<void>;
  onPreApproveOneTapProfit: () => Promise<void>;
  isApprovalPending: boolean;
  isOneTapProfitApprovalPending: boolean;
  disabled?: boolean;
  onMobileClose?: () => void;
}

export const TradeActionButtons: React.FC<TradeActionButtonsProps> = ({
  tradeMode,
  tapToTrade,
  activeMarket,
  marginAmount,
  leverage,
  timeframe,
  currentPrice,
  hasLargeAllowance,
  hasLargeOneTapProfitAllowance,
  hasSelectedYGrid,
  wallets,

  onPreApprove,
  onPreApproveOneTapProfit,
  isApprovalPending,
  isOneTapProfitApprovalPending,
  disabled,
  onMobileClose,
}) => {
  const handleMainAction = async () => {
    if (tradeMode === 'open-position' && !hasLargeAllowance) {
      await onPreApprove();
    } else if (tradeMode === 'one-tap-profit' && !hasLargeOneTapProfitAllowance) {
      await onPreApproveOneTapProfit();
    }

    if (!marginAmount || parseFloat(marginAmount) === 0) {
      toast.error(
        tradeMode === 'one-tap-profit' ? 'Please enter bet amount' : 'Please enter margin amount',
      );
      return;
    }

    if (tradeMode === 'open-position' && !hasSelectedYGrid) {
      toast.error('Please select Y Coordinate (Price Grid) first');
      return;
    }

    if (tradeMode === 'open-position') {
      await tapToTrade.toggleMode({
        symbol: activeMarket?.symbol || 'BTC',
        margin: marginAmount,
        leverage: leverage,
        timeframe: timeframe,
        currentPrice: Number(currentPrice) || 0,
      });
      onMobileClose?.();
    } else {
      // Binary Trading Logic
      try {
        toast.loading('Creating session key...', {
          id: 'binary-session',
        });

        const embeddedWallet = wallets.find((w) => w.walletClientType === 'privy');
        if (!embeddedWallet) throw new Error('Privy wallet not found');

        const walletClient = await embeddedWallet.getEthereumProvider();
        if (!walletClient) throw new Error('Could not get wallet client');

        console.log(
          '🔍 [TradeActionButtons] Approving for Contract:',
          process.env.NEXT_PUBLIC_ONE_TAP_PROFIT_ADDRESS,
        );

        const newSession = await tapToTrade.createSession(
          embeddedWallet.address,
          walletClient,
          30 * 60 * 1000,
        );

        if (!newSession) throw new Error('Session creation failed');

        await tapToTrade.toggleMode({
          symbol: activeMarket?.symbol || 'BTC',
          margin: marginAmount,
          leverage: 1,
          timeframe: '1',
          currentPrice: Number(currentPrice) || 0,
        });

        tapToTrade.setIsBinaryTradingEnabled(true);
        toast.success('Binary Trading enabled!', { id: 'binary-session', duration: 5000 });
        onMobileClose?.();
      } catch (error) {
        console.error('Failed to enable binary trading:', error);
        toast.error('Failed to enable binary trading', { id: 'binary-session' });
      }
    }
  };

  const STOP_ACTION = async () => {
    if (tradeMode === 'one-tap-profit') {
      tapToTrade.setIsBinaryTradingEnabled(false);
      await tapToTrade.toggleMode();
      toast.success('Binary Trading stopped');
    } else {
      await tapToTrade.toggleMode();
    }
  };

  if (tapToTrade.isEnabled) {
    return (
      <Button
        variant="destructive"
        size="lg"
        onClick={STOP_ACTION}
        disabled={tapToTrade.isLoading}
        className="w-full mt-2 font-bold shadow-lg shadow-destructive/30"
      >
        {tapToTrade.isLoading
          ? 'Stopping...'
          : tradeMode === 'one-tap-profit'
          ? 'Stop Binary Trading'
          : 'Stop Tap to Trade'}
      </Button>
    );
  }

  // Determine Button State
  let buttonText = 'Enable Tap to Trade';
  let isLoading = false;
  let variant: 'default' | 'secondary' | 'destructive' | 'outline' | 'ghost' | 'link' = 'default';

  if (tradeMode === 'open-position') {
    if (!hasLargeAllowance) {
      buttonText = isApprovalPending ? 'Approving USDC...' : 'Enable One-Click Trading';
      isLoading = isApprovalPending;
      variant = 'default';
    } else {
      buttonText = tapToTrade.isLoading ? 'Setting up session...' : 'Enable Tap to Trade';
      isLoading = tapToTrade.isLoading;
    }
  } else {
    if (!hasLargeOneTapProfitAllowance) {
      buttonText = isOneTapProfitApprovalPending ? 'Approving USDC...' : 'Enable One-Click Binary';
      isLoading = isOneTapProfitApprovalPending;
    } else {
      buttonText = tapToTrade.isLoading ? 'Setting up session...' : 'Enable Binary Trade';
      isLoading = tapToTrade.isLoading;
    }
  }

  return (
    <Button
      size="lg"
      className="w-full mt-2 font-bold shadow-lg shadow-primary/30"
      onClick={handleMainAction}
      disabled={disabled || isLoading}
    >
      {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      {buttonText}
    </Button>
  );
};
