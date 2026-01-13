import { usePrivy } from '@privy-io/react-auth';
import { toast } from 'sonner';

export const useWalletActions = () => {
  const { user, exportWallet, logout } = usePrivy();

  const getEmbeddedWalletAddress = () => {
    const embeddedWallets = user?.linkedAccounts?.filter(
      (account: any) =>
        account.type === 'wallet' && account.imported === false && account.id !== undefined,
    ) as any[];
    return embeddedWallets?.[0]?.address || user?.wallet?.address;
  };

  const handleCopyAddress = () => {
    const address = getEmbeddedWalletAddress();
    if (address) {
      navigator.clipboard.writeText(address);
      toast.success('Address copied!');
    }
  };

  const handleViewExplorer = () => {
    const address = getEmbeddedWalletAddress();
    if (address) {
      window.open(`https://sepolia.basescan.org/address/${address}`, '_blank');
    }
  };

  const handleExportPrivateKey = async () => {
    try {
      const embeddedWallets = user?.linkedAccounts?.filter(
        (account: any) =>
          account.type === 'wallet' && account.imported === false && account.id !== undefined,
      ) as any[];

      if (!embeddedWallets || embeddedWallets.length === 0) {
        toast.error('Embedded wallet not found. Please reconnect your wallet.');
        return;
      }

      const embeddedWalletAddress = embeddedWallets[0]?.address;
      if (!embeddedWalletAddress) {
        toast.error('Embedded wallet address not found');
        return;
      }

      await exportWallet({ address: embeddedWalletAddress });
      toast.success('Private key exported successfully!');
    } catch (error: any) {
      console.error('Error exporting wallet:', error);
      toast.error(error?.message || 'Failed to export private key');
    }
  };

  const handleDisconnect = () => {
    logout();
    toast.success('Wallet disconnected');
  };

  const shortAddress = (() => {
    const address = getEmbeddedWalletAddress();
    return address
      ? `${address.substring(0, 6)}...${address.substring(address.length - 4)}`
      : 'Connected';
  })();

  return {
    handleCopyAddress,
    handleViewExplorer,
    handleExportPrivateKey,
    handleDisconnect,
    shortAddress,
    getEmbeddedWalletAddress,
  };
};
