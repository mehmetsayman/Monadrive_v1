"use client";

import { Loader2 } from "lucide-react";
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
    <div className="mb-10 flex items-end justify-between gap-4 border-y-[1.5px] border-ink py-4">
      <div className="min-w-0">
        <p className="label">Rapor geliriniz</p>
        <p className="mt-1 flex items-baseline gap-2">
          <span className="partno text-[40px] leading-none">{formatEther(balance)}</span>
          <span className="numeric text-[14px] text-ink-3">MON</span>
        </p>
      </div>

      {balance > 0n && (
        <button
          type="button"
          disabled={busy}
          onClick={() => writeContract({ ...registry, functionName: "withdrawEarnings" })}
          className="btn shrink-0"
        >
          {busy && <Loader2 className="size-4 animate-spin" />}
          {busy ? "Çekiliyor" : "Çek"}
        </button>
      )}
    </div>
  );
}
