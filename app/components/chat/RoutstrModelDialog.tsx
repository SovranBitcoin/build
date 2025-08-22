import { memo, useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogButton,
  DialogClose,
  DialogRoot,
  DialogTitle,
} from "~/components/ui/Dialog";
import { WalletDialog } from "~/components/chat/WalletDialog";
import { chatStore } from "~/lib/stores/chat";
import { useBalance } from "~/lib/hooks/useBalance";
import { classNames } from "~/utils/classNames";
import type { ModelInfo } from "~/lib/modules/llm/types";

interface RoutstrModelDialogProps {
  isOpen: boolean;
  onClose: () => void;
  models: ModelInfo[];
  selectedModel?: string;
  onModelSelect: (modelName: string) => void;
}

// Custom cursor-following tooltip component
interface CursorTooltipProps {
  content: string;
  children: React.ReactNode;
}

const CursorTooltip = ({ content, children }: CursorTooltipProps) => {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  const handleMouseEnter = () => setIsVisible(true);
  const handleMouseLeave = () => setIsVisible(false);

  const handleMouseMove = (e: React.MouseEvent) => {
    setPosition({
      x: e.clientX - 200, // Small offset to bottom right of cursor
      y: e.clientY - 125,
    });
  };

  return (
    <>
      <div
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onMouseMove={handleMouseMove}
      >
        {children}
      </div>
      {isVisible && (
        <div
          className="fixed z-[2000] px-2 py-1 text-xs bg-bolt-elements-background-depth-3 text-bolt-elements-textPrimary rounded shadow-lg border border-bolt-elements-borderColor pointer-events-none max-w-xs"
          style={{
            left: position.x,
            top: position.y,
          }}
        >
          {content}
        </div>
      )}
    </>
  );
};

export const RoutstrModelDialog = memo(
  ({
    isOpen,
    onClose,
    models,
    selectedModel,
    onModelSelect,
  }: RoutstrModelDialogProps) => {
    const formatInteger = (value?: number) => {
      if (typeof value !== "number") {
        return "—";
      }

      return value.toLocaleString();
    };

    const formatDecimal = (value?: number) => {
      if (typeof value !== "number") {
        return "—";
      }

      const fixed = value.toFixed(6);

      return fixed.replace(/\.0+$/, "").replace(/\.(?=\D|$)/, "");
    };

    const { balanceSats, refresh: refreshBalance } = useBalance();

    type SortMode = "cheapest" | "expensive";

    const [sortMode, setSortMode] = useState<SortMode>("expensive");
    const [providerFilter, setProviderFilter] = useState<string>("all");
    const [hideDisabled, setHideDisabled] = useState<boolean>(true);
    const [walletDialogOpen, setWalletDialogOpen] = useState<boolean>(false);

    // Extract Routstr models with full data
    const routstrModels = useMemo(() => {
      return models
        .filter((m) => m.provider === "Routstr" && m.routstrData)
        .map((m) => m.routstrData!);
    }, [models]);

    const filteredModels = useMemo(() => {
      return routstrModels
        .slice()
        .filter(
          (m) =>
            providerFilter === "all" ||
            (m.id || "").split("/")[0] === providerFilter,
        )
        .filter((model) => {
          if (!hideDisabled) {
            return true;
          }

          const minCostSats = model.sats_pricing?.max_cost
            ? model.sats_pricing.max_cost
            : 0;
          const isAffordable =
            typeof minCostSats === "number" ? balanceSats >= minCostSats : true;
          const isContextLargeEnough =
            typeof model.context_length === "number"
              ? model.context_length >= 200_000
              : true;

          return isAffordable && isContextLargeEnough;
        });
    }, [routstrModels, providerFilter, hideDisabled, balanceSats]);

    const providerList = useMemo(() => {
      // Get all providers from routstrModels to always show all provider options
      const allPrefixes = routstrModels
        .map((m) => (m.id || "").split("/")[0])
        .filter((p): p is string => Boolean(p));

      // Get unique providers
      const uniqueProviders = Array.from(new Set(allPrefixes));

      // Count how many filtered models each provider has
      const providerCounts = uniqueProviders.reduce(
        (acc, provider) => {
          const count = routstrModels.filter((model) => {
            // Check if model belongs to this provider
            if ((model.id || "").split("/")[0] !== provider) {
              return false;
            }

            // Apply the same filtering logic as filteredModels (excluding provider filter)
            if (!hideDisabled) {
              return true;
            }

            const minCostSats = model.sats_pricing?.max_cost
              ? model.sats_pricing.max_cost
              : 0;
            const isAffordable =
              typeof minCostSats === "number"
                ? balanceSats >= minCostSats
                : true;
            const isContextLargeEnough =
              typeof model.context_length === "number"
                ? model.context_length >= 200_000
                : true;

            return isAffordable && isContextLargeEnough;
          }).length;

          acc[provider] = count;

          return acc;
        },
        {} as Record<string, number>,
      );

      // Return providers sorted by count (descending)
      return uniqueProviders
        .map((provider) => ({
          name: provider,
          count: providerCounts[provider],
        }))
        .sort((a, b) => b.count - a.count);
    }, [routstrModels, hideDisabled, balanceSats]);

    // refresh wallet balance when opening menu
    useEffect(() => {
      if (isOpen) {
        try {
          void refreshBalance();
        } catch {}
      }
    }, [isOpen, refreshBalance]);

    return (
      <DialogRoot open={isOpen} onOpenChange={onClose}>
        {isOpen && (
          <Dialog className="p-4 min-w-[860px]">
            <div className="p-2 sm:p-4">
              <div className="flex items-center justify-between gap-3 mb-3">
                <DialogTitle>
                  <span className="i-ph:brain w-5 h-5" />
                  Select Model
                </DialogTitle>
                <div className="flex items-center gap-2 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setHideDisabled(!hideDisabled)}
                    className={classNames(
                      "px-2 py-1 rounded border text-xs transition-theme",
                      hideDisabled
                        ? "bg-bolt-elements-item-backgroundAccent text-bolt-elements-item-contentAccent border-bolt-elements-item-backgroundAccent"
                        : "bg-bolt-elements-background-depth-3 text-bolt-elements-textPrimary border-bolt-elements-borderColor",
                    )}
                  >
                    {hideDisabled ? "Show All" : "Hide Disabled"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSortMode("cheapest")}
                    className={classNames(
                      "px-2 py-1 rounded border text-xs transition-theme",
                      sortMode === "cheapest"
                        ? "bg-bolt-elements-item-backgroundAccent text-bolt-elements-item-contentAccent border-bolt-elements-item-backgroundAccent"
                        : "bg-bolt-elements-background-depth-3 text-bolt-elements-textPrimary border-bolt-elements-borderColor",
                    )}
                  >
                    Cheapest
                  </button>
                  <button
                    type="button"
                    onClick={() => setSortMode("expensive")}
                    className={classNames(
                      "px-2 py-1 rounded border text-xs transition-theme",
                      sortMode === "expensive"
                        ? "bg-bolt-elements-item-backgroundAccent text-bolt-elements-item-contentAccent border-bolt-elements-item-backgroundAccent"
                        : "bg-bolt-elements-background-depth-3 text-bolt-elements-textPrimary border-bolt-elements-borderColor",
                    )}
                  >
                    Expensive
                  </button>
                </div>
              </div>
              {providerList.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 mb-3 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setProviderFilter("all")}
                    className={classNames(
                      "px-2 py-1 rounded border text-xs transition-theme",
                      providerFilter === "all"
                        ? "bg-bolt-elements-item-backgroundAccent text-bolt-elements-item-contentAccent border-bolt-elements-item-backgroundAccent"
                        : "bg-bolt-elements-background-depth-3 text-bolt-elements-textPrimary border-bolt-elements-borderColor",
                    )}
                  >
                    All ({filteredModels.length})
                  </button>
                  {providerList.map((provider) => (
                    <button
                      key={provider.name}
                      type="button"
                      onClick={() => setProviderFilter(provider.name)}
                      className={classNames(
                        "px-2 py-1 rounded border text-xs transition-theme",
                        providerFilter === provider.name
                          ? "bg-bolt-elements-item-backgroundAccent text-bolt-elements-item-contentAccent border-bolt-elements-item-backgroundAccent"
                          : "bg-bolt-elements-background-depth-3 text-bolt-elements-textPrimary border-bolt-elements-borderColor",
                      )}
                    >
                      {provider.name} ({provider.count})
                    </button>
                  ))}
                </div>
              )}

              <div className="border rounded-md border-bolt-elements-borderColor overflow-scroll max-h-[500px]">
                {filteredModels.length === 0 && (
                  <div className="px-4 py-6 text-sm text-bolt-elements-textTertiary text-center">
                    No models found
                  </div>
                )}
                {filteredModels
                  .sort((a, b) => {
                    const aIn =
                      typeof a.sats_pricing?.prompt === "number"
                        ? a.sats_pricing!.prompt!
                        : Number.MAX_SAFE_INTEGER;
                    const aOut =
                      typeof a.sats_pricing?.completion === "number"
                        ? a.sats_pricing!.completion!
                        : Number.MAX_SAFE_INTEGER;
                    const bIn =
                      typeof b.sats_pricing?.prompt === "number"
                        ? b.sats_pricing!.prompt!
                        : Number.MAX_SAFE_INTEGER;
                    const bOut =
                      typeof b.sats_pricing?.completion === "number"
                        ? b.sats_pricing!.completion!
                        : Number.MAX_SAFE_INTEGER;
                    const aPrice = (aIn || 0) + (aOut || 0);
                    const bPrice = (bIn || 0) + (bOut || 0);

                    return sortMode === "cheapest"
                      ? aPrice - bPrice
                      : bPrice - aPrice;
                  })
                  .map((model) => {
                    const inSats = model.sats_pricing?.prompt;
                    const outSats = model.sats_pricing?.completion;
                    const minCostSats = model.sats_pricing?.max_cost
                      ? model.sats_pricing.max_cost
                      : 0;

                    const isAffordable =
                      typeof minCostSats === "number"
                        ? balanceSats >= minCostSats
                        : true;

                    const isContextLargeEnough =
                      typeof model.context_length === "number"
                        ? model.context_length >= 200_000
                        : true;

                    const isDisabled = !isContextLargeEnough || !isAffordable;

                    // Generate tooltip content for disabled models
                    const getTooltipContent = () => {
                      const reasons = [];

                      if (!isAffordable) {
                        reasons.push("Insufficient funds");
                      }

                      if (!isContextLargeEnough) {
                        reasons.push(
                          "Models with less than 200k tokens are disabled",
                        );
                      }

                      return reasons.join(" • ");
                    };

                    const modelRow = (
                      <div
                        key={model.id}
                        className={classNames(
                          "flex items-center px-4 py-2",
                          !isDisabled
                            ? "cursor-pointer hover:bg-bolt-elements-item-backgroundActive"
                            : "opacity-50 cursor-not-allowed",
                        )}
                        onClick={() => {
                          if (isDisabled) {
                            return;
                          }

                          onModelSelect(model.id);
                          chatStore.setKey("selectedModelId", model.id);
                          chatStore.setKey(
                            "selectedMaxCompletionTokens",
                            model.top_provider?.max_completion_tokens ??
                              undefined,
                          );
                          chatStore.setKey(
                            "selectedContextLength",
                            model.top_provider?.context_length ??
                              model.context_length ??
                              undefined,
                          );
                          onClose();
                        }}
                      >
                        <div className="flex-1 min-w-0 pr-3">
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-sm text-bolt-elements-textPrimary truncate">
                              {model.name || model.id}
                            </span>
                          </div>
                          <div className="mt-1 flex items-center gap-2">
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-bolt-elements-background-depth-3 border border-bolt-elements-borderColor font-mono text-bolt-elements-textSecondary truncate max-w-[60%]">
                              {model.id}
                            </span>
                          </div>
                        </div>
                        <div className="w-6 flex-shrink-0 flex items-center justify-center">
                          {selectedModel === model.id && (
                            <span className="i-ph:check-circle text-bolt-elements-item-contentAccent text-base" />
                          )}
                        </div>
                        <div className="grid grid-cols-5 gap-3 text-[11px] font-mono whitespace-nowrap text-right min-w-[340px]">
                          <div className="flex flex-col items-end">
                            <span className="text-bolt-elements-textTertiary">
                              Context
                            </span>
                            <span className="text-bolt-elements-textSecondary">
                              {formatInteger(model.context_length)}
                            </span>
                          </div>
                          <div className="flex flex-col items-end">
                            <span className="text-bolt-elements-textTertiary">
                              Input
                            </span>
                            <span className="text-bolt-elements-textSecondary">
                              {formatDecimal(inSats)}
                            </span>
                          </div>
                          <div className="flex flex-col items-end">
                            <span className="text-bolt-elements-textTertiary">
                              Output
                            </span>
                            <span className="text-bolt-elements-textSecondary">
                              {formatDecimal(outSats)}
                            </span>
                          </div>
                          <div className="flex flex-col items-end">
                            <span className="text-bolt-elements-textTertiary">
                              Min Balance
                            </span>
                            <span className="text-bolt-elements-textSecondary">
                              {minCostSats.toFixed(0)} sats
                            </span>
                          </div>
                          <div className="flex flex-col items-end">
                            <span className="text-bolt-elements-textTertiary">
                              Max Completion
                            </span>
                            <span className="text-bolt-elements-textSecondary">
                              {formatInteger(
                                model.top_provider?.max_completion_tokens,
                              )}
                            </span>
                          </div>
                        </div>
                      </div>
                    );

                    // Return tooltip-wrapped row for disabled models, plain row for enabled ones
                    return isDisabled ? (
                      <CursorTooltip
                        key={model.id}
                        content={getTooltipContent()}
                      >
                        {modelRow}
                      </CursorTooltip>
                    ) : (
                      modelRow
                    );
                  })}
              </div>

              <div className="flex justify-between items-center gap-2 mt-4">
                <div className="flex items-center gap-2">
                  {balanceSats === 0 ? (
                    <button
                      type="button"
                      onClick={() => setWalletDialogOpen(true)}
                      className="px-3 py-2 rounded border text-sm transition-theme bg-green-500/10 hover:bg-green-500/20 text-green-500 border-green-500/30 flex items-center gap-2"
                    >
                      <div className="i-ph:wallet w-4 h-4" />
                      Create Wallet to unlock more models
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setWalletDialogOpen(true)}
                      className="px-3 py-2 rounded border text-sm transition-theme bg-green-500/10 hover:bg-green-500/20 text-green-500 border-green-500/30 flex items-center gap-2"
                    >
                      <div className="i-ph:wallet w-4 h-4" />
                      Top Up Wallet to unlock more models
                    </button>
                  )}
                </div>
                <DialogClose asChild>
                  <DialogButton type="secondary">Close</DialogButton>
                </DialogClose>
              </div>
            </div>
          </Dialog>
        )}

        {/* Wallet Dialog */}
        <WalletDialog
          isOpen={walletDialogOpen}
          onClose={() => {
            setWalletDialogOpen(false);

            // Refresh balance after wallet dialog closes
            try {
              void refreshBalance();
            } catch {}
          }}
        />
      </DialogRoot>
    );
  },
);
