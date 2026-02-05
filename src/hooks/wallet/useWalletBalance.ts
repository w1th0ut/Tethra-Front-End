import { useState, useEffect, useCallback, useRef } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { createPublicClient, http, formatUnits } from 'viem';
import { baseSepolia } from 'wagmi/chains';
import { USDC_ADDRESS, USDC_DECIMALS } from '@/config/contracts';

export const useWalletBalance = () => {
  const { authenticated, user } = usePrivy();
  const [usdcBalance, setUsdcBalance] = useState<string | null>(null);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  const refreshTimeoutsRef = useRef<number[]>([]);

  const fetchUsdcBalance = useCallback(async () => {
    if (!authenticated || !user) return;

    const embeddedWallets = user.linkedAccounts?.filter(
      (account: any) =>
        account.type === 'wallet' && account.imported === false && account.id !== undefined,
    ) as any[];

    const embeddedWalletAddress = embeddedWallets?.[0]?.address || user?.wallet?.address;

    if (!embeddedWalletAddress) return;

    setIsLoadingBalance(true);
    try {
      const publicClient = createPublicClient({
        chain: baseSepolia,
        transport: http(),
      });

      const balance = (await publicClient.readContract({
        address: USDC_ADDRESS,
        abi: [
          {
            constant: true,
            inputs: [{ name: '_owner', type: 'address' }],
            name: 'balanceOf',
            outputs: [{ name: 'balance', type: 'uint256' }],
            type: 'function',
          },
        ],
        functionName: 'balanceOf',
        args: [embeddedWalletAddress as `0x${string}`],
      })) as bigint;

      const formattedBalance = formatUnits(balance, USDC_DECIMALS);
      setUsdcBalance(parseFloat(formattedBalance).toFixed(2));
    } catch (error) {
      // Keep last known balance on error.
    } finally {
      setIsLoadingBalance(false);
    }
  }, [authenticated, user]);

  useEffect(() => {
    if (authenticated && user) {
      fetchUsdcBalance();
    }
  }, [authenticated, user, fetchUsdcBalance]);

  useEffect(() => {
    if (!authenticated || !user) return;
    if (typeof window === 'undefined') return;

    const clearRefreshTimeouts = () => {
      refreshTimeoutsRef.current.forEach((timeoutId) => {
        window.clearTimeout(timeoutId);
      });
      refreshTimeoutsRef.current = [];
    };

    const scheduleRefreshes = () => {
      clearRefreshTimeouts();

      fetchUsdcBalance();

      const delays = [2000, 6000, 12000];
      refreshTimeoutsRef.current = delays.map((delay) =>
        window.setTimeout(() => {
          fetchUsdcBalance();
        }, delay),
      );
    };

    window.addEventListener('tethra:refreshBalance', scheduleRefreshes);
    return () => {
      window.removeEventListener('tethra:refreshBalance', scheduleRefreshes);
      clearRefreshTimeouts();
    };
  }, [authenticated, user, fetchUsdcBalance]);

  const bumpBalance = useCallback((delta: number) => {
    setUsdcBalance((previous) => {
      if (previous === null) return previous;
      const current = Number(previous);
      if (Number.isNaN(current)) return previous;
      return (current + delta).toFixed(2);
    });
  }, []);

  return {
    usdcBalance,
    isLoadingBalance,
    refetchBalance: fetchUsdcBalance,
    bumpBalance,
  };
};
