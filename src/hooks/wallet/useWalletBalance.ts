import { useState, useEffect } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { createPublicClient, http, formatUnits } from 'viem';
import { baseSepolia } from 'wagmi/chains';
import { USDC_ADDRESS, USDC_DECIMALS } from '@/config/contracts';

export const useWalletBalance = () => {
  const { authenticated, user } = usePrivy();
  const [usdcBalance, setUsdcBalance] = useState<string | null>(null);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);

  useEffect(() => {
    const fetchUsdcBalance = async () => {
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
        console.error('Error fetching USDC balance:', error);
        setUsdcBalance('0.00');
      } finally {
        setIsLoadingBalance(false);
      }
    };

    if (authenticated && user) {
      fetchUsdcBalance();
    }
  }, [authenticated, user]);

  return { usdcBalance, isLoadingBalance };
};
