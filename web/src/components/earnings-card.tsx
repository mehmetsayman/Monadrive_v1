"use client";

import { Coins, Loader2 } from "lucide-react";
import { useEffect } from "react";
import { formatEther } from "viem";
import {
  useAccount,
  useReadContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";

import { monadTestnet } from "@/lib/chain";
import { registry } from "@/lib/registry";

/**
 * What this garage has earned from buyers opening reports on cars it worked on.
 *
 * This is the whole answer to "why would a mechanic type this in?", so it belongs
 * on the garage's own screen rather than buried in a dashboard.
 */
export function EarningsCard() {
  const { address, isConnected, chainId } = useAccount();
  const onRightNetwork = isConnected && chainId === monadTestnet.id;

  const { data: owed, refetch } = useReadContract({
    ...registry,
    functionName: "earnings",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address) && onRightNetwork },
  });

  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  useEffect(() => {
    if (isSuccess) refetch();
  }, [isSuccess, refetch]);

  if (!onRightNetwork || owed === undefined) return null;

  const balance = owed as bigint;
  const busy = isPending || isConfirming;

  return (
    <div className="glass mb-6 flex items-center gap-4 px-5 py-4">
      <Coins className="size-5 shrink-0 text-neon" />

      <div className="min-w-0 flex-1">
        <p className="label">Rapor geliriniz</p>
        <p className="numeric mt-0.5 text-lg font-semibold text-bright">
          {formatEther(balance)} <span className="text-sm font-normal text-muted">MON</span>
        </p>
      </div>

      {balance > 0n && (
        <button
          type="button"
          disabled={busy}
          onClick={() => writeContract({ ...registry, functionName: "withdrawEarnings" })}
          className="inline-flex shrink-0 items-center gap-2 rounded-full border border-neon/40 bg-neon/10 px-4 py-2 text-sm font-medium text-neon transition hover:bg-neon/20 disabled:opacity-60"
        >
          {busy && <Loader2 className="size-3.5 animate-spin" />}
          {busy ? "Çekiliyor" : "Çek"}
        </button>
      )}
    </div>
  );
}
