"use client";

import { ArrowRight, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { isCompleteVin, normalizeVin } from "@/lib/registry";
import { cn } from "@/lib/utils";

const EXAMPLES = [
  { vin: "WVWZZZ1JZXW000001", label: "Temiz geçmiş" },
  { vin: "NM0GE9F79E1234567", label: "Hafif kazalı" },
  { vin: "1HGBH41JXMN109186", label: "Ağır hasarlı" },
];

/**
 * The query box, drawn like the install command on a datasheet: one ruled row,
 * the input, and the action fused to its right edge.
 */
export function VinSearch({ autoFocus = false }: { autoFocus?: boolean }) {
  const router = useRouter();
  const [vin, setVin] = useState("");
  const [busy, setBusy] = useState(false);

  const ready = isCompleteVin(vin);

  function go(event: FormEvent) {
    event.preventDefault();
    if (!ready) return;
    setBusy(true);
    router.push(`/vehicle/${normalizeVin(vin)}`);
  }

  return (
    <div className="w-full">
      <form onSubmit={go} className="flex border-[1.5px] border-ink bg-white">
        <label className="flex min-w-0 flex-1 items-center gap-3 px-4">
          <Search className="size-4 shrink-0 text-ink-3" strokeWidth={2} />
          <span className="sr-only">Şasi numarası</span>
          <input
            value={vin}
            autoFocus={autoFocus}
            onChange={(e) => setVin(normalizeVin(e.target.value).slice(0, 17))}
            placeholder="Şasi numarası (17 hane)"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            className="numeric w-full min-w-0 bg-transparent py-3.5 text-[15px] tracking-[0.04em] text-ink outline-none placeholder:font-sans placeholder:tracking-normal placeholder:text-ink-3"
          />
          <span className="numeric shrink-0 text-[12px] text-ink-3">{vin.length}/17</span>
        </label>
        <button
          type="submit"
          disabled={!ready || busy}
          className={cn(
            "flex shrink-0 items-center gap-2 border-l-[1.5px] border-ink px-5 text-[14px] font-semibold transition",
            ready && !busy
              ? "bg-ink text-white hover:bg-red"
              : "cursor-not-allowed bg-paper-2 text-ink-3",
          )}
        >
          {busy ? "Sorgulanıyor..." : "Sorgula"}
          {!busy && <ArrowRight className="size-4" strokeWidth={2} />}
        </button>
      </form>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="label">Örnek araçlar</span>
        {EXAMPLES.map((example) => (
          <button
            key={example.vin}
            type="button"
            onClick={() => setVin(example.vin)}
            className="border border-hair bg-white px-2.5 py-1 text-[13px] text-ink-2 transition hover:border-ink hover:text-ink"
          >
            {example.label}
          </button>
        ))}
      </div>
    </div>
  );
}
