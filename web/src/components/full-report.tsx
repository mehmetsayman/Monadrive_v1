"use client";

import { ArrowRight, Loader2, Lock } from "lucide-react";
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

import { SectionHeading } from "./datasheet";
import { MileageChart } from "./mileage-chart";
import { RecordsTable } from "./records-table";
import { WalletButton } from "./wallet-button";

/**
 * The gated half of a vehicle page: section 2 of the datasheet.
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
      <section>
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <SectionHeading n={2}>Servis geçmişi</SectionHeading>
          <span className="numeric text-[12.5px] text-green">
            ● rapor açık{paidMs !== null && ` · ödeme ${paidMs} ms'de onaylandı`}
          </span>
        </div>
        <p className="mb-7 max-w-[62ch] text-[15px] text-ink-2">
          Aracın doğduğu günden bugüne her kaydı. Kaza satırları işaretli; bir satırın
          tarihinin üstüne gelince zincire ne zaman yazıldığı görünür.
        </p>

        {records ? (
          <div className="space-y-10">
            <MileageChart records={[...records]} />
            <RecordsTable records={[...records]} garages={garages} />
          </div>
        ) : (
          <div className="flex items-center gap-3 border-y-[1.5px] border-ink py-6 text-[14px] text-ink-2">
            <Loader2 className="size-4 animate-spin text-red" />
            Kayıtlar zincirden okunuyor...
          </div>
        )}
      </section>
    );
  }

  // --- locked --------------------------------------------------------------

  const priceLabel = formatEther(price);
  const garagePct = garageShareBps / 100;

  return (
    <section>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <SectionHeading n={2}>Servis geçmişi</SectionHeading>
        <span className="tag">Kısıtlı</span>
      </div>
      <p className="mb-7 max-w-[62ch] text-[15px] text-ink-2">
        Bu bölüm tam raporda açılır: aracın 100 üzerinden sağlık skoru, her kaydın
        tarihi, kilometresi, notu, imzalayan servis ve varsa fotoğrafı.
      </p>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        {/* The table's shape, with its contents withheld. */}
        <div className="tbl-wrap" aria-hidden="true">
          <table className="ds">
            <caption>
              <span className="cap-n">Tablo 2.</span> Servis kayıtları
            </caption>
            <thead>
              <tr>
                <th>No.</th>
                <th>Tarih</th>
                <th className="text-right">Km</th>
                <th>İşlem</th>
                <th>Servis</th>
              </tr>
            </thead>
            <tbody>
              {[0.62, 0.48, 0.7, 0.55, 0.4].map((width, row) => (
                <tr key={row}>
                  <td className="numeric text-ink-3">{row + 1}</td>
                  {[0.7, 0.5, 0.8, width].map((w, col) => (
                    <td key={col}>
                      <span
                        className="block h-3 bg-band"
                        style={{ width: `${Math.round(w * 100)}%` }}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="border-[1.5px] border-ink p-6">
          <div className="flex items-center gap-2.5">
            <Lock className="size-5 text-red" strokeWidth={2} />
            <span className="label">Tam rapor</span>
          </div>

          <p className="mt-5 flex items-baseline gap-2">
            <span className="partno text-[56px]">{priceLabel}</span>
            <span className="numeric text-[15px] text-ink-3">MON · tek seferlik</span>
          </p>

          <ul className="features mt-5">
            <li>Bu araç cüzdanınızda kalıcı olarak açılır</li>
            {garageCount > 0 && (
              <li>
                Ücretin <b>%{garagePct}</b>’i bu aracın geçmişini yazan{" "}
                <b>{garageCount} servise</b> paylaştırılır
              </li>
            )}
            <li>Ödeme Monad’da saniyenin altında onaylanır</li>
          </ul>

          <div className="mt-6">
            {!onRightNetwork ? (
              <div className="space-y-2.5">
                <WalletButton className="w-full" />
                <p className="text-[12.5px] text-ink-3">Rapor satın almak için cüzdan gerekiyor</p>
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
                className="btn w-full"
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
                    Tam raporu aç
                    <ArrowRight className="size-4" strokeWidth={2} />
                  </>
                )}
              </button>
            )}

            {error && (
              <p className="mt-3 border-l-[3px] border-red bg-red-wash px-3 py-2 text-[13px] text-red-ink">
                {error.message.includes("AlreadyPurchased")
                  ? "Bu rapor zaten bu cüzdana açık."
                  : error.message.split("\n")[0]}
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
