import { atom } from "nanostores";
import { getApiKeysFromCookies } from "~/components/chat/APIKeyManager";

export interface BalanceState {
  balanceSats: number;
  loading: boolean;
  error: string | undefined;
}

// Initialize balance store
export const balanceStore = atom<BalanceState>({
  balanceSats: 0,
  loading: true,
  error: undefined,
});

// Global refresh function that updates the store
export const refreshBalance = async (): Promise<void> => {
  console.log("🔄 Refreshing balance...");
  
  // Set loading state
  balanceStore.set({
    ...balanceStore.get(),
    loading: true,
    error: undefined,
  });

  try {
    const apiKeys = getApiKeysFromCookies();
    const routstrApiKey = apiKeys.Routstr;

    if (!routstrApiKey) {
      throw new Error(
        "Routstr API key not found. Please set your API key in settings.",
      );
    }

    const res = await fetch("https://api.routstr.com/v1/wallet/", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${routstrApiKey}`,
      },
    });

    const data = (await res.json()) as { balance?: number };
    console.log("💰 Balance API response:", data);

    const newBalance = Number(data?.balance ?? 0);
    console.log("💰 Setting new balance:", newBalance);

    // Update store with new balance
    balanceStore.set({
      balanceSats: newBalance,
      loading: false,
      error: undefined,
    });

    console.log("✅ Balance updated in store:", balanceStore.get());
  } catch (err: any) {
    console.error("❌ Balance refresh failed:", err);
    
    // Update store with error
    balanceStore.set({
      balanceSats: 0,
      loading: false,
      error: err?.message || "Failed to fetch balance",
    });
  }
};

// Top up wallet with Cashu token
export const topupWalletRequest = async (cashuToken: string) => {
  const apiKeys = getApiKeysFromCookies();
  const routstrApiKey = apiKeys.Routstr;

  if (!routstrApiKey) {
    throw new Error(
      "Routstr API key not found. Please set your API key in settings.",
    );
  }

  const response = await fetch(
    "https://api.routstr.com/v1/wallet/topup?cashu_token=" + cashuToken,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${routstrApiKey}`,
      },
    },
  );

  if (!response.ok) {
    const errorData = (await response.json().catch(() => ({}))) as any;
    throw new Error(errorData.error || `Topup failed: ${response.status}`);
  }

  return response.json();
};
