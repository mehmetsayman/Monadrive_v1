"use client";

import { Lock } from "lucide-react";
import Image from "next/image";
import { useAccount, useReadContract } from "wagmi";

import { monadTestnet } from "@/lib/chain";
import { registry } from "@/lib/registry";

import { LockedScoreBar, ScoreBar } from "./score-gauge";

/**
 * The vehicle's on-chain NFT image and its health score.
 *
 * Both are gated, and the image is gated *because* of the score - the on-chain
 * SVG has "SCORE 53/100" painted into it, so showing the picture would hand over
 * the number the paywall is holding back.
 *
 * Neither is loaded on the server. They are read here, in the browser, only once
 * the chain confirms this wallet has access, so nothing leaks into the page
 * source for a visitor who has not paid.
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

/** Figure 2: the dNFT, as the chain renders it. */
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

  return (
    <figure className="m-0">
      <div className="fig-frame aspect-square w-full max-w-[260px]">
        {unlocked && image ? (
          <Image
            src={image}
            alt="Aracın zincirde üretilen dNFT görseli"
            width={260}
            height={260}
            unoptimized
            className="block size-full"
          />
        ) : (
          <div
            className="flex size-full flex-col items-center justify-center gap-2"
            style={{
              backgroundImage:
                "repeating-linear-gradient(135deg, #f4f4f1 0 8px, transparent 8px 16px)",
            }}
          >
            <Lock className="size-5 text-red" strokeWidth={2} />
            <span className="label">dNFT görseli kilitli</span>
          </div>
        )}
      </div>
      <figcaption className="mt-2.5 max-w-[260px] text-[12.5px] text-ink-2">
        <span className="font-bold text-ink">Şekil 2.</span> Zincirde üretilen dNFT; her
        kayıtla yeniden çizilir.
      </figcaption>
    </figure>
  );
}

/** The health score on its scale, withheld until the report is open. */
export function VehicleScore({ tokenId }: { tokenId: string }) {
  const id = BigInt(tokenId);
  const unlocked = useReportAccess(id);

  const { data: score } = useReadContract({
    ...registry,
    functionName: "healthScore",
    args: [id],
    query: { enabled: unlocked },
  });

  if (!unlocked || score === undefined) return <LockedScoreBar />;

  return <ScoreBar score={Number(score)} />;
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
