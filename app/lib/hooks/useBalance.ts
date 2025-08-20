import { useCallback, useEffect, useState } from "react";
import { getApiKeysFromCookies } from "~/components/chat/APIKeyManager";

export function useBalance() {
  const [balanceSats, setBalanceSats] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | undefined>(undefined);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(undefined);

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

      setBalanceSats(Number(data?.balance ?? 0));
    } catch (err: any) {
      setError(err?.message || "Failed to fetch balance");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, []);

  return {
    balanceSats: balanceSats / 1000,
    loading,
    error,
    refresh,
    userId: null,
  };
}

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
