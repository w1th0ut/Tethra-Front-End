'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { createWalletClient, custom, encodeFunctionData, parseUnits } from 'viem';
import { baseSepolia } from 'viem/chains';

const USDC_ADDRESS = process.env.NEXT_PUBLIC_USDC_TOKEN_ADDRESS as `0x${string}`;
const ONE_TAP_PROFIT_ADDRESS = process.env.NEXT_PUBLIC_ONE_TAP_PROFIT_ADDRESS as `0x${string}`;

const USDC_ABI = [
  {
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    name: 'approve',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    name: 'allowance',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

export const useOneTapProfitApproval = () => {
  const { authenticated } = usePrivy();
  const { wallets } = useWallets();
  const [allowance, setAllowance] = useState<bigint | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const embeddedWallet = wallets.find((w) => w.walletClientType === 'privy');

  // Check current allowance
  const checkAllowance = useCallback(async () => {
    if (!authenticated || !embeddedWallet) {
      setAllowance(null);
      return;
    }

    try {
      setIsLoading(true);
      const ethereumProvider = await embeddedWallet.getEthereumProvider();
      const userAddress = embeddedWallet.address as `0x${string}`;

      const allowanceData = encodeFunctionData({
        abi: USDC_ABI,
        functionName: 'allowance',
        args: [userAddress, ONE_TAP_PROFIT_ADDRESS],
      });

      const result = await ethereumProvider.request({
        method: 'eth_call',
        params: [
          {
            to: USDC_ADDRESS,
            data: allowanceData,
          },
          'latest',
        ],
      });

      const currentAllowance = BigInt(result as string);
      setAllowance(currentAllowance);
    } catch (error) {
      console.error('Failed to check OneTapProfit allowance:', error);
      setAllowance(null);
    } finally {
      setIsLoading(false);
    }
  }, [authenticated, embeddedWallet]);

  // Auto-check allowance on mount and when wallet changes
  useEffect(() => {
    checkAllowance();
  }, [checkAllowance]);

  // Approve USDC spending
  const approve = useCallback(
    async (amount: string) => {
      if (!authenticated || !embeddedWallet) {
        throw new Error('Wallet not connected');
      }

      setIsPending(true);

      try {
        const ethereumProvider = await embeddedWallet.getEthereumProvider();
        const userAddress = embeddedWallet.address as `0x${string}`;

        const walletClient = createWalletClient({
          account: userAddress,
          chain: baseSepolia,
          transport: custom(ethereumProvider),
        });

        const approveData = encodeFunctionData({
          abi: USDC_ABI,
          functionName: 'approve',
          args: [ONE_TAP_PROFIT_ADDRESS, BigInt(amount)],
        });

        const txHash = await walletClient.sendTransaction({
          account: userAddress,
          to: USDC_ADDRESS,
          data: approveData,
        });

        // Wait a bit for transaction to be mined
        await new Promise((resolve) => setTimeout(resolve, 3000));

        // Refresh allowance
        await checkAllowance();

        return txHash;
      } catch (error) {
        console.error('Failed to approve USDC for OneTapProfit:', error);
        throw error;
      } finally {
        setIsPending(false);
      }
    },
    [authenticated, embeddedWallet, checkAllowance],
  );

  // Check if user has sufficient allowance for a specific amount
  const hasAllowance = useCallback(
    (requiredAmount?: string) => {
      if (!allowance) return false;
      if (!requiredAmount) return allowance > 0n;

      try {
        const required = parseUnits(requiredAmount, 6);
        return allowance >= required;
      } catch {
        return false;
      }
    },
    [allowance],
  );

  return {
    allowance,
    hasAllowance,
    approve,
    isPending,
    isLoading,
    checkAllowance,
  };
};
