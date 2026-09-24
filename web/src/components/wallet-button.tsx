"use client";

import { AlertTriangle, LogOut, Wallet } from "lucide-react";
import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";

import { monadTestnet } from "@/lib/chain";
import { cn, shortAddress } from "@/lib/utils";

export function WalletButton({ className }: { className?: string }) {
  const { address, isConnected, chainId } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: isSwitching } = useSwitchChain();

  const injected = connectors[0];
  const wrongNetwork = isConnected && chainId !== monadTestnet.id;

  if (!isConnected) {
    return (
      <button
        type="button"
        disabled={isPending || !injected}
        onClick={() => injected && connect({ connector: injected })}
        className={cn(
          "inline-flex items-center gap-2 rounded-full border border-violet/40 bg-violet/15 px-5 py-2.5",
          "text-sm font-medium text-bright transition",
          "hover:border-violet hover:bg-violet/25 disabled:opacity-50",
          className,
        )}
      >
        <Wallet className="size-4" />
        {isPending ? "Bağlanıyor..." : "Cüzdan Bağla"}
      </button>
    );
  }

  if (wrongNetwork) {
    return (
      <button
        type="button"
        disabled={isSwitching}
        onClick={() => switchChain({ chainId: monadTestnet.id })}
        className={cn(
          "inline-flex items-center gap-2 rounded-full border border-amber/50 bg-amber/15 px-5 py-2.5",
          "text-sm font-medium text-amber transition hover:bg-amber/25 disabled:opacity-50",
          className,
        )}
      >
        <AlertTriangle className="size-4" />
        {isSwitching ? "Ağ değişiyor..." : "Monad Testnet'e geç"}
      </button>
    );
  }

  return (
    <div
      className={cn(
        "inline-flex items-center gap-3 rounded-full border border-violet/25 bg-ink/60 py-1.5 pl-4 pr-1.5",
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-neon shadow-[0_0_8px_var(--color-neon)]" />
      <span className="numeric text-sm text-muted">{shortAddress(address!)}</span>
      <button
        type="button"
        onClick={() => disconnect()}
        aria-label="Cüzdan bağlantısını kes"
        className="rounded-full p-2 text-faint transition hover:bg-violet/15 hover:text-bright"
      >
        <LogOut className="size-3.5" />
      </button>
    </div>
  );
}
