import { useStore } from "@nanostores/react";
import { useEffect } from "react";
import {
  balanceStore,
  refreshBalance,
  topupWalletRequest as topupWalletRequestFromStore,
} from "~/lib/stores/balance";

export function useBalance() {
  const balance = useStore(balanceStore);

  // Auto-refresh balance on first mount
  useEffect(() => {
    refreshBalance();
  }, []);

  return {
    balanceSats: balance.balanceSats / 1000, // Removed division by 1000 to test
    loading: balance.loading,
    error: balance.error,
    refresh: refreshBalance,
    userId: null,
  };
}

// Re-export topupWalletRequest for backward compatibility
export const topupWalletRequest = topupWalletRequestFromStore;
