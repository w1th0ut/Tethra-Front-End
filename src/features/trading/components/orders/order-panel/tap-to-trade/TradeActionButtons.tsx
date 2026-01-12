import React from 'react';
import { toast } from 'react-hot-toast';
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
  binarySessionKey: any;
  // New props for handling approval directly
  onPreApprove: () => Promise<void>;
  onPreApproveOneTapProfit: () => Promise<void>;
  isApprovalPending: boolean;
  isOneTapProfitApprovalPending: boolean;
  disabled?: boolean;
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
  binarySessionKey,
  onPreApprove,
  onPreApproveOneTapProfit,
  isApprovalPending,
  isOneTapProfitApprovalPending,
  disabled,
}) => {
  // Helper for checking requirements before starting Open Position Mode
  const canStartOpenPosition = () => {
    if (!hasLargeAllowance) return false;
    if (!hasSelectedYGrid) return false;
    if (!marginAmount || parseFloat(marginAmount) === 0) return false;
    return true;
  };

  const handleMainAction = async () => {
    // 1. Handle Approval if needed
    if (tradeMode === 'open-position' && !hasLargeAllowance) {
      await onPreApprove();
      // Continue to start trade after approval
    } else if (tradeMode === 'one-tap-profit' && !hasLargeOneTapProfitAllowance) {
      await onPreApproveOneTapProfit();
      // Continue to start binary mode after approval
    }

    // 2. Handle missing inputs (Validation)
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

    // 3. Start Mode
    if (tradeMode === 'open-position') {
      await tapToTrade.toggleMode({
        symbol: activeMarket?.symbol || 'BTC',
        margin: marginAmount,
        leverage: leverage,
        timeframe: timeframe,
        currentPrice: Number(currentPrice) || 0,
      });
    } else {
      // Binary Trading Logic
      try {
        toast.loading('Creating session key for gasless binary trading...', {
          id: 'binary-session',
        });

        const embeddedWallet = wallets.find((w) => w.walletClientType === 'privy');
        if (!embeddedWallet) throw new Error('Privy wallet not found');

        const walletClient = await embeddedWallet.getEthereumProvider();
        if (!walletClient) throw new Error('Could not get wallet client');

        await binarySessionKey.createSession(embeddedWallet.address, walletClient, 30 * 60 * 1000);

        if (!binarySessionKey.isSessionValid()) throw new Error('Session creation failed');

        await tapToTrade.toggleMode({
          symbol: activeMarket?.symbol || 'BTC',
          margin: marginAmount,
          leverage: 1,
          timeframe: '1',
          currentPrice: Number(currentPrice) || 0,
        });

        tapToTrade.setIsBinaryTradingEnabled(true);
        toast.success('✅ Binary Trading enabled!', { id: 'binary-session', duration: 5000 });
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
      variant = 'default'; // Or a specific color for 'Approval needed'
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
      disabled={
        disabled ||
        isLoading ||
        (tradeMode === 'open-position' && hasLargeAllowance && !hasSelectedYGrid)
      }
    >
      {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      {buttonText}
    </Button>
  );
};
