"use client";

import { AlertTriangle, LogOut, Wallet } from "lucide-react";
import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";

import { monadTestnet } from "@/lib/chain";
import { cn, shortAddress } from "@/lib/utils";

/**
 * Connect, switch network, or show who is connected.
 *
 * Two surfaces: white on the red top band, black on paper. Same states on both.
 */
export function WalletButton({
  variant = "default",
  className,
}: {
  variant?: "default" | "on-red";
  className?: string;
}) {
  const { address, isConnected, chainId } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: isSwitching } = useSwitchChain();

  const injected = connectors[0];
  const wrongNetwork = isConnected && chainId !== monadTestnet.id;
  const onRed = variant === "on-red";

  if (!isConnected) {
    return (
      <button
        type="button"
        disabled={isPending || !injected}
        onClick={() => injected && connect({ connector: injected })}
        className={cn("btn shrink-0", onRed && "btn-on-red", className)}
      >
        <Wallet className="size-4" strokeWidth={2} />
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
        className={cn("btn shrink-0", onRed && "btn-on-red", className)}
      >
        <AlertTriangle className="size-4" strokeWidth={2} />
        {isSwitching ? "Ağ değişiyor..." : "Monad Testnet'e geç"}
      </button>
    );
  }

  return (
    <div
      className={cn(
        "inline-flex shrink-0 items-center border-[1.5px]",
        onRed ? "border-white text-white" : "border-ink text-ink",
        className,
      )}
    >
      <span className="flex items-center gap-2 px-3 py-[7px]">
        <span className={cn("size-2", onRed ? "bg-white" : "bg-green")} aria-hidden="true" />
        <span className="numeric text-[13px]">{shortAddress(address!)}</span>
      </span>
      <button
        type="button"
        onClick={() => disconnect()}
        aria-label="Cüzdan bağlantısını kes"
        className={cn(
          "self-stretch border-l-[1.5px] px-2.5 transition",
          onRed
            ? "border-white hover:bg-white hover:text-red"
            : "border-ink hover:bg-ink hover:text-white",
        )}
      >
        <LogOut className="size-3.5" />
      </button>
    </div>
  );
}
