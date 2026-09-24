import { ExternalLink, Paperclip } from "lucide-react";

import { explorerAddress } from "@/lib/chain";
import { recordType, TONE_TEXT, type VehicleRecord } from "@/lib/registry";
import type { Garage } from "@/lib/server";
import { cn, formatDate, formatKm, shortAddress } from "@/lib/utils";

const IPFS_GATEWAY =
  process.env.NEXT_PUBLIC_IPFS_GATEWAY ?? "https://gateway.pinata.cloud/ipfs";

const DOT_BG = {
  good: "bg-neon",
  warn: "bg-amber",
  bad: "bg-danger",
  neutral: "bg-violet",
} as const;

/**
 * The car's life, newest first. Every node carries who said it and when, because
 * a history is only as good as the people who signed it.
 */
export function Timeline({
  records,
  garages,
}: {
  records: VehicleRecord[];
  garages: Map<string, Garage>;
}) {
  return (
    <ol className="relative">
      {/* The spine. Stops at the last dot rather than running past it. */}
      <div
        className="absolute left-[7px] top-2 w-px bg-gradient-to-b from-violet/40 to-violet/5"
        style={{ bottom: "1.5rem" }}
        aria-hidden="true"
      />

      {records.map((record, index) => {
        const type = recordType(record.recordType);
        const garage = garages.get(record.reporter.toLowerCase());
        const isLatest = index === 0;

        return (
          <li key={`${record.timestamp}-${index}`} className="relative pb-7 pl-8 last:pb-0">
            <span
              className={cn(
                "absolute left-0 top-1.5 size-[15px] rounded-full border-4 border-void",
                DOT_BG[type.tone],
                isLatest && "ring-4 ring-violet/20",
              )}
              aria-hidden="true"
            />

            <div className="glass px-5 py-4">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <span className={cn("text-sm font-semibold", TONE_TEXT[type.tone])}>
                  {type.label}
                </span>
                <span className="numeric text-base text-bright">
                  {formatKm(record.mileage)} km
                </span>
              </div>

              {record.note && (
                <p className="mt-2 text-sm leading-relaxed text-muted">{record.note}</p>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-faint">
                <time dateTime={new Date(record.timestamp * 1000).toISOString()}>
                  {formatDate(record.timestamp)}
                </time>
                <span aria-hidden="true">·</span>
                <a
                  href={explorerAddress(record.reporter)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 transition hover:text-violet-bright"
                >
                  {garage?.name ?? shortAddress(record.reporter)}
                  <ExternalLink className="size-3" />
                </a>
                {record.ipfsCid && (
                  <>
                    <span aria-hidden="true">·</span>
                    <a
                      href={`${IPFS_GATEWAY}/${record.ipfsCid}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-violet-bright transition hover:underline"
                    >
                      <Paperclip className="size-3" />
                      Belge
                    </a>
                  </>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
