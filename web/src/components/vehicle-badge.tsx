"use client";

import { Lock } from "lucide-react";
import Image from "next/image";
import { useAccount, useReadContract } from "wagmi";

import { monadTestnet } from "@/lib/chain";
import { registry } from "@/lib/registry";

import { ScoreGauge } from "./score-gauge";

/**
 * The vehicle's face: its on-chain NFT image and its health score.
 *
 * Both are gated, and the image is gated *because* of the score - the on-chain
 * SVG has "SCORE 53/100" painted into it, so showing the picture would hand over
 * the number the paywall is holding back.
 *
 * Neither is loaded on the server. They are read here, in the browser, only once
 * the chain confirms this wallet has access, so nothing leaks into the page
 * source for a visitor who has not paid.
 *
 * They ship as two components rather than one because they sit in different
 * columns of the identity band, with the vehicle's details between them.
 */

function useReportAccess(id: bigint) {
  const { address, isConnected, chainId } = useAccount();
  const onRightNetwork = isConnected && chainId === monadTestnet.id;

  const { data } = useReadContract({
    ...registry,
    functionName: "hasReportAccess",
    args: address ? [id, address] : undefined,
    query: { enabled: Boolean(address) && onRightNetwork },
  });

  return data === true;
}

export function VehicleImage({ tokenId }: { tokenId: string }) {
  const id = BigInt(tokenId);
  const unlocked = useReportAccess(id);

  const { data: uri } = useReadContract({
    ...registry,
    functionName: "tokenURI",
    args: [id],
    query: { enabled: unlocked },
  });

  const image = decodeImage(uri as string | undefined);

  // An outline rather than a filled box: a second surface inside the identity
  // card reads as a card within a card.
  if (!unlocked || !image) {
    return (
      <div className="mx-auto flex size-[168px] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-violet/30">
        <Lock className="size-5 text-violet-dim" />
        <span className="label">dNFT görseli</span>
      </div>
    );
  }

  return (
    <Image
      src={image}
      alt="Aracın zincirde üretilen NFT görseli"
      width={168}
      height={168}
      unoptimized
      className="mx-auto rounded-2xl border border-violet/25"
    />
  );
}

export function VehicleScore({ tokenId }: { tokenId: string }) {
  const id = BigInt(tokenId);
  const unlocked = useReportAccess(id);

  const { data: score } = useReadContract({
    ...registry,
    functionName: "healthScore",
    args: [id],
    query: { enabled: unlocked },
  });

  if (!unlocked || score === undefined) return <LockedScore />;

  return <ScoreGauge score={Number(score)} className="mx-auto" />;
}

/**
 * An empty gauge with a lock in it. The ring is still there, so it is obvious a
 * score exists and that this is part of what is being bought.
 */
function LockedScore() {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className="mx-auto flex flex-col items-center gap-3">
      <div className="relative size-[132px]">
        <svg viewBox="0 0 132 132" className="size-full -rotate-90" aria-hidden="true">
          <circle
            cx="66"
            cy="66"
            r={radius}
            fill="none"
            stroke="var(--color-slate)"
            strokeWidth="9"
          />
          <circle
            cx="66"
            cy="66"
            r={radius}
            fill="none"
            stroke="var(--color-violet-dim)"
            strokeWidth="9"
            strokeLinecap="round"
            strokeDasharray={`${circumference * 0.08} ${circumference}`}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5">
          <Lock className="size-6 text-violet-bright" />
          <span className="numeric text-sm text-faint">? / 100</span>
        </div>
      </div>
      <p className="text-sm font-medium text-violet-bright">Sağlık skoru kilitli</p>
    </div>
  );
}

/** Pulls the SVG out of the base64 metadata the contract returns. */
function decodeImage(uri: string | undefined): string | null {
  if (!uri) return null;

  try {
    const encoded = uri.split(",")[1];
    if (!encoded) return null;

    const metadata = JSON.parse(atob(encoded)) as { image?: string };
    return metadata.image ?? null;
  } catch {
    return null;
  }
}
