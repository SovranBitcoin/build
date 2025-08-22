import React, { useEffect, useState } from "react";
import { useBalance, topupWalletRequest } from "~/lib/hooks/useBalance";
import { refreshBalance } from "~/lib/stores/balance";
import {
  Dialog,
  DialogDescription,
  DialogRoot,
  DialogTitle,
} from "~/components/ui/Dialog";
import { classNames } from "~/utils/classNames";
import { getApiKeysFromCookies } from "./APIKeyManager";
import Cookies from "js-cookie";

interface WalletDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function WalletDialog({ isOpen, onClose }: WalletDialogProps) {
  const { balanceSats, loading, error, userId } = useBalance();

  const [topupToken, setTopupToken] = useState("");
  const [topupLoading, setTopupLoading] = useState(false);
  const [topupError, setTopupError] = useState<string | undefined>(undefined);
  const [topupSuccess, setTopupSuccess] = useState(false);
  const [isNewWallet, setIsNewWallet] = useState(false);

  // Check if user has existing API key
  const hasExistingApiKey = !!getApiKeysFromCookies().Routstr;

  useEffect(() => {
    if (!topupSuccess) {
      return undefined;
    }

    const t = setTimeout(() => {
      setTopupSuccess(false);
      setIsNewWallet(false);
    }, 3000);

    return () => clearTimeout(t);
  }, [topupSuccess]);

  // Refresh balance when dialog opens
  useEffect(() => {
    if (isOpen) {
      refreshBalance();
    }
  }, [isOpen]);

  const handleTopup = async () => {
    if (!topupToken.trim() || topupLoading) {
      return;
    }

    setTopupError(undefined);
    setTopupSuccess(false);
    setTopupLoading(true);

    try {
      // Check if Routstr API key already exists
      const apiKeys = getApiKeysFromCookies();
      const hasRoutstrApiKey = !!apiKeys.Routstr;

      if (!hasRoutstrApiKey) {
        // First time: Use GET /wallet/ to create/check wallet with the Cashu token
        const response = await fetch("https://api.routstr.com/v1/wallet/", {
          method: "GET",
          headers: {
            Authorization: `Bearer ${topupToken.trim()}`,
          },
        });

        if (!response.ok) {
          const errorData = (await response.json().catch(() => ({}))) as any;
          throw new Error(
            errorData.error || `Wallet creation failed: ${response.status}`,
          );
        }

        // Set the token as the API key for future use
        const currentKeys = getApiKeysFromCookies();
        const newKeys = { ...currentKeys, Routstr: topupToken.trim() };
        Cookies.set("apiKeys", JSON.stringify(newKeys));
        console.log("Cashu token set as Routstr API key");
        setIsNewWallet(true);
      } else {
        // Existing wallet: Use topup endpoint
        await topupWalletRequest(topupToken.trim());
      }

      setTopupSuccess(true);
      setTopupToken("");

      // Refresh balance after successful operation - this will update all components
      await refreshBalance();
    } catch (err: any) {
      setTopupError(
        err?.message ||
          (hasExistingApiKey ? "Topup failed" : "Wallet creation failed"),
      );
    } finally {
      setTopupLoading(false);
    }
  };

  return (
    <DialogRoot open={isOpen} onOpenChange={onClose}>
      {isOpen && (
        <Dialog onClose={onClose}>
          <div className="p-6">
            <DialogTitle>Wallet</DialogTitle>
            <DialogDescription>
              <div className="pb-5 space-y-4">
                {/* Balance section */}
                {loading ? (
                  <div className="rounded-lg border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 p-4">
                    <div className="text-bolt-elements-textSecondary">
                      Loading balance…
                    </div>
                  </div>
                ) : error ===
                  "Routstr API key not found. Please set your API key in settings." ? (
                  <></>
                ) : error ? (
                  <div className="rounded-lg border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 p-4">
                    <div className="text-bolt-elements-icon-error">{error}</div>
                  </div>
                ) : (
                  <div className="rounded-lg border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 p-4">
                    <div className="text-bolt-elements-textPrimary">
                      <div className="flex items-center gap-2">
                        <div className="i-ph:wallet text-lg" />
                        <span className="font-medium">Balance</span>
                        <span className="font-mono text-bolt-elements-textSecondary">
                          {balanceSats}
                        </span>
                        <span className="text-bolt-elements-textTertiary text-xs">
                          sats
                        </span>
                      </div>
                      {userId && (
                        <div className="text-xs text-bolt-elements-textTertiary mt-1">
                          User ID: {userId}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Topup section */}
                <div className="rounded-lg border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 p-4">
                  <div className="text-sm font-medium text-bolt-elements-textPrimary mb-2">
                    {hasExistingApiKey ? "Top up" : "Create Wallet"}
                  </div>
                  <div className="text-xs text-bolt-elements-textTertiary mb-3">
                    {hasExistingApiKey
                      ? "Paste a Cashu token to add funds to your wallet."
                      : "Paste a Cashu token to create your wallet. This token will become your wallet identity."}
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      aria-label="Cashu token"
                      className="flex-1 min-w-0 rounded-md border border-bolt-elements-borderColor bg-bolt-elements-item-backgroundDefault px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-bolt-elements-item-contentAccent"
                      placeholder="cashuA1Dkp..."
                      value={topupToken}
                      onChange={(e) => setTopupToken(e.target.value)}
                    />
                    <button
                      type="button"
                      className={classNames(
                        "px-3 py-2 rounded-md text-sm disabled:opacity-60",
                        topupLoading
                          ? "bg-bolt-elements-item-backgroundDefault text-bolt-elements-textSecondary border border-bolt-elements-borderColor cursor-wait"
                          : "bg-bolt-elements-item-backgroundAccent text-bolt-elements-item-contentAccent",
                      )}
                      onClick={handleTopup}
                      disabled={!topupToken.trim() || topupLoading}
                    >
                      {topupLoading
                        ? hasExistingApiKey
                          ? "Topping up…"
                          : "Creating wallet…"
                        : hasExistingApiKey
                          ? "Topup"
                          : "Create Wallet"}
                    </button>
                  </div>
                  {topupError && (
                    <div className="mt-2 text-xs text-bolt-elements-icon-error">
                      {topupError}
                    </div>
                  )}
                  {topupSuccess && !topupError && (
                    <div className="mt-2 text-xs text-bolt-elements-icon-success">
                      {isNewWallet
                        ? "Wallet created and funded successfully!"
                        : "Topup successful"}
                    </div>
                  )}
                </div>
              </div>
            </DialogDescription>
          </div>
        </Dialog>
      )}
    </DialogRoot>
  );
}
