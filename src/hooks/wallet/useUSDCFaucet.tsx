import { useState } from 'react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { encodeFunctionData } from 'viem';
import { toast } from 'sonner';
import { USDC_ADDRESS } from '@/config/contracts';
import React from 'react';

// Mock USDC ABI with faucet function
const MOCK_USDC_ABI = [
  {
    inputs: [],
    name: 'faucet',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: '',
        type: 'address',
      },
    ],
    name: 'hasClaimed',
    outputs: [
      {
        internalType: 'bool',
        name: '',
        type: 'bool',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

export const useUSDCFaucet = () => {
  const { authenticated, user } = usePrivy();
  const { wallets } = useWallets();
  const [isClaiming, setIsClaiming] = useState(false);

  const handleClaimUSDC = async () => {
    if (!authenticated || !user) {
      toast.error('Please connect your wallet first');
      return;
    }

    const embeddedWallet = wallets.find((w) => w.walletClientType === 'privy');
    if (!embeddedWallet) {
      toast.error('Embedded wallet not found');
      return;
    }

    const walletAddress = embeddedWallet.address;
    setIsClaiming(true);
    const loadingToast = toast.loading('Checking claim status...');

    try {
      const provider = await embeddedWallet.getEthereumProvider();
      if (!provider) throw new Error('Could not get wallet provider');

      // Check if user has already claimed
      const hasClaimedData = encodeFunctionData({
        abi: MOCK_USDC_ABI,
        functionName: 'hasClaimed',
        args: [walletAddress as `0x${string}`],
      });

      const hasClaimedResult = await provider.request({
        method: 'eth_call',
        params: [
          {
            to: USDC_ADDRESS,
            data: hasClaimedData,
          },
          'latest',
        ],
      });

      const alreadyClaimed =
        hasClaimedResult !== '0x0000000000000000000000000000000000000000000000000000000000000000';

      if (alreadyClaimed) {
        toast.error(
          'You have already claimed USDC from the faucet. Each wallet can only claim once.',
          { id: loadingToast, duration: 5000 },
        );
        return;
      }

      toast.loading('Claiming USDC from faucet...', { id: loadingToast });

      const data = encodeFunctionData({
        abi: MOCK_USDC_ABI,
        functionName: 'faucet',
        args: [],
      });

      const txHash = await provider.request({
        method: 'eth_sendTransaction',
        params: [
          {
            from: walletAddress,
            to: USDC_ADDRESS,
            data: data,
          },
        ],
      });

      toast.success('USDC claimed successfully! 🎉', {
        id: loadingToast,
        duration: 4000,
      });

      // Show transaction link
      setTimeout(() => {
        toast.success(
          <div className="flex flex-col gap-1">
            <span>View on Explorer:</span>
            <a
              href={`https://sepolia.basescan.org/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline text-blue-400 hover:text-blue-300"
            >
              Click here
            </a>
          </div>,
          { duration: 5000 },
        );
      }, 500);

      // Reload the page to refresh balance
      setTimeout(() => {
        window.location.reload();
      }, 2000);

      return txHash;
    } catch (error: any) {
      let errorMessage = 'Failed to claim USDC from faucet';
      if (error?.message?.includes('user rejected')) {
        errorMessage = 'Transaction was rejected';
      } else if (error?.message) {
        errorMessage = error.message;
      }
      toast.error(errorMessage, { id: loadingToast });
    } finally {
      setIsClaiming(false);
    }
  };

  return { isClaiming, handleClaimUSDC };
};
