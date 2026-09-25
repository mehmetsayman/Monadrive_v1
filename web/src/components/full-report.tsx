"use client";

import { Loader2, Lock, Store, Unlock } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { formatEther } from "viem";
import {
  useAccount,
  useReadContract,
  useReadContracts,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";

import { monadTestnet } from "@/lib/chain";
import { registry, type VehicleRecord } from "@/lib/registry";
import type { Garage } from "@/lib/server";
import { shortAddress } from "@/lib/utils";

import { Timeline } from "./timeline";
import { WalletButton } from "./wallet-button";

/**
 * The gated half of a vehicle page.
 *
 * Records are fetched here, in the browser, only after the chain says this wallet
 * has access. Loading them on the server and hiding them with CSS would ship the
 * whole report in the page source.
 */
export function FullReport({
  tokenId,
  priceWei,
  garageCount,
  garageShareBps,
}: {
  tokenId: string;
  priceWei: string;
  garageCount: number;
  garageShareBps: number;
}) {
  const id = BigInt(tokenId);
  const { address, isConnected, chainId } = useAccount();
  const onRightNetwork = isConnected && chainId === monadTestnet.id;

  const [paidMs, setPaidMs] = useState<number | null>(null);
  const sentAt = useRef<number | null>(null);

  // Price and split come from the server, so the paywall renders complete on
  // first paint instead of flashing a placeholder while wagmi warms up.
  const price = BigInt(priceWei);

  const { data: hasAccess, refetch: refetchAccess } = useReadContract({
    ...registry,
    functionName: "hasReportAccess",
    args: address ? [id, address] : undefined,
    query: { enabled: Boolean(address) && onRightNetwork },
  });

  const unlocked = hasAccess === true;

  const { data: records } = useReadContract({
    ...registry,
    functionName: "getRecords",
    args: [id],
    query: { enabled: unlocked },
  }) as { data: readonly VehicleRecord[] | undefined };

  // Names for whoever wrote the records, resolved once we know who they are.
  const reporters = [...new Set((records ?? []).map((r) => r.reporter))];
  const { data: providers } = useReadContracts({
    contracts: reporters.map((reporter) => ({
      ...registry,
      functionName: "getServiceProvider" as const,
      args: [reporter] as const,
    })),
    query: { enabled: reporters.length > 0 },
  });

  const garages = new Map<string, Garage>(
    reporters.map((reporter, index) => {
      const provider = providers?.[index]?.result as
        | { name: string; recordCount: number; active: boolean }
        | undefined;
      return [
        reporter.toLowerCase(),
        {
          address: reporter,
          name: provider?.name || shortAddress(reporter),
          recordCount: Number(provider?.recordCount ?? 0),
          active: Boolean(provider?.active),
        },
      ];
    }),
  );

  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  useEffect(() => {
    if (hash && sentAt.current === null) sentAt.current = Date.now();
  }, [hash]);

  useEffect(() => {
    if (isSuccess && sentAt.current !== null) {
      setPaidMs(Date.now() - sentAt.current);
      sentAt.current = null;
      refetchAccess();
    }
  }, [isSuccess, refetchAccess]);

  // --- unlocked ------------------------------------------------------------

  if (unlocked) {
    return (
      <div>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-bright">
            Servis geçmişi
            <span className="ml-2 font-normal text-faint">
              {records ? `${records.length} kayıt, en yeniden eskiye` : "yükleniyor..."}
            </span>
          </h2>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-neon/35 bg-neon/10 px-3 py-1 text-xs text-neon">
            <Unlock className="size-3" />
            Rapor açık
            {paidMs !== null && <span className="numeric">· {paidMs} ms</span>}
          </span>
        </div>

        {records ? (
          <Timeline records={[...records].reverse()} garages={garages} />
        ) : (
          <div className="glass flex items-center gap-3 px-5 py-6 text-sm text-muted">
            <Loader2 className="size-4 animate-spin text-violet-bright" />
            Kayıtlar zincirden okunuyor...
          </div>
        )}
      </div>
    );
  }

  // --- locked --------------------------------------------------------------

  const priceLabel = formatEther(price);

  return (
    <div>
      <h2 className="mb-5 text-sm font-semibold text-bright">Servis geçmişi</h2>

      <div className="glass glass-lit relative overflow-hidden px-6 py-10 text-center">
        {/* A hint of the timeline behind the lock, so it is clear what is being bought. */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-[0.07]">
          <div className="space-y-4 p-6">
            {[90, 70, 85, 60].map((width, index) => (
              <div key={index} className="flex items-center gap-3">
                <span className="size-3 shrink-0 rounded-full bg-violet" />
                <span className="h-9 rounded-lg bg-violet" style={{ width: `${width}%` }} />
              </div>
            ))}
          </div>
        </div>

        <div className="relative mx-auto max-w-md space-y-5">
          {/* Not a panel of its own: a card inside a card is depth nobody asked
              for. A ring does the same job without the second surface. */}
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl border border-violet/30">
            <Lock className="size-6 text-violet-bright" />
          </div>

          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-bright">Tam rapor kilitli</h3>
            <p className="text-sm leading-relaxed text-muted">
              Aracın 100 üzerinden sağlık skoru, her kaydın tarihi, notu, hangi
              servisin yazdığı ve varsa fotoğrafı bu raporda. Bir kez ödeyin, bu
              araç cüzdanınızda kalıcı olarak açılsın.
            </p>
          </div>

          <p className="numeric text-3xl font-semibold text-bright">
            {priceLabel} <span className="text-base font-normal text-muted">MON</span>
          </p>

          {garageCount > 0 && (
            <p className="flex items-center justify-center gap-2 text-xs text-faint">
              <Store className="size-3.5 shrink-0" />
              Bu ücretin %{garageShareBps / 100}&apos;i, bu aracın geçmişini yazan{" "}
              {garageCount} servise paylaştırılır
            </p>
          )}

          {!onRightNetwork ? (
            <div className="flex flex-col items-center gap-3">
              <WalletButton />
              <p className="text-xs text-faint">Rapor satın almak için cüzdan gerekiyor</p>
            </div>
          ) : (
            <button
              type="button"
              disabled={isPending || isConfirming}
              onClick={() =>
                writeContract({
                  ...registry,
                  functionName: "purchaseReport",
                  args: [id],
                  value: price,
                })
              }
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-violet px-6 py-4 text-sm font-semibold text-white raised transition hover:bg-violet-bright disabled:opacity-60"
            >
              {isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Cüzdanda onaylayın
                </>
              ) : isConfirming ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Ödeme ağa gönderildi
                </>
              ) : (
                <>
                  <Unlock className="size-4" />
                  Tam raporu aç
                </>
              )}
            </button>
          )}

          {error && (
            <p className="text-xs text-danger">
              {error.message.includes("AlreadyPurchased")
                ? "Bu rapor zaten bu cüzdana açık."
                : error.message.split("\n")[0]}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
