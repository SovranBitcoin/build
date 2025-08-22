import { useStore } from "@nanostores/react";
import { workbenchStore } from "~/lib/stores/workbench";
import { useState } from "react";
import { streamingState } from "~/lib/stores/streaming";
import { ExportChatButton } from "~/components/chat/chatExportAndImport/ExportChatButton";
import { useChatHistory } from "~/lib/persistence";
import { DeployButton } from "~/components/deploy/DeployButton";
import { useBalance } from "~/lib/hooks/useBalance";
import { refreshBalance } from "~/lib/stores/balance";
import { WalletDialog } from "~/components/chat/WalletDialog";

interface HeaderActionButtonsProps {
  chatStarted: boolean;
}

export function HeaderActionButtons({ chatStarted }: HeaderActionButtonsProps) {
  const [activePreviewIndex] = useState(0);
  const previews = useStore(workbenchStore.previews);
  const activePreview = previews[activePreviewIndex];
  const isStreaming = useStore(streamingState);
  const { exportChat } = useChatHistory();
  const { balanceSats, loading } = useBalance();

  const [walletOpen, setWalletOpen] = useState(false);

  const shouldShowButtons = !isStreaming && activePreview;

  return (
    <div className="flex items-center">
      {chatStarted && shouldShowButtons && (
        <ExportChatButton exportChat={exportChat} />
      )}
      {shouldShowButtons && <DeployButton />}

      {/* Wallet button */}
      <button
        type="button"
        className="ml-2 h-8 px-2 inline-flex items-center gap-1 rounded-md border border-bolt-elements-borderColor bg-bolt-elements-item-backgroundDefault text-xs text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive"
        onClick={async () => {
          setWalletOpen(true);

          try {
            await refreshBalance();
          } catch {}
        }}
        title="Wallet"
      >
        <div className="i-ph:wallet" />
        <span className="font-mono leading-none">
          {loading ? "…" : balanceSats}
        </span>
        <span className="leading-none">sats</span>
      </button>

      {/* Wallet dialog */}
      <WalletDialog isOpen={walletOpen} onClose={() => setWalletOpen(false)} />
    </div>
  );
}
