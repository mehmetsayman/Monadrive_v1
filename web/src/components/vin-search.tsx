"use client";

import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { isCompleteVin, normalizeVin } from "@/lib/registry";
import { cn } from "@/lib/utils";

const EXAMPLES = [
  { vin: "WVWZZZ1JZXW000001", label: "Temiz geçmiş" },
  { vin: "NM0GE9F79E1234567", label: "Hafif kazalı" },
  { vin: "1HGBH41JXMN109186", label: "Ağır hasarlı" },
];

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
      <form onSubmit={go} className="flex flex-col gap-3 sm:flex-row">
        <div
          className={cn(
            "flex flex-1 items-center gap-3 rounded-2xl border bg-ink/50 px-5 py-4 transition",
            "focus-within:border-violet focus-within:bg-ink/80",
            "border-violet/25",
          )}
        >
          <Search className="size-4 shrink-0 text-faint" />
          <input
            value={vin}
            autoFocus={autoFocus}
            onChange={(e) => setVin(normalizeVin(e.target.value).slice(0, 17))}
            placeholder="Şasi numarasını girin"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            aria-label="Şasi numarası"
            className="numeric w-full bg-transparent text-base tracking-[0.08em] text-bright outline-none placeholder:font-sans placeholder:tracking-normal placeholder:text-faint/70"
          />
          <span className="numeric shrink-0 text-xs text-faint">{vin.length}/17</span>
        </div>

        <button
          type="submit"
          disabled={!ready || busy}
          className={cn(
            "rounded-2xl px-8 py-4 text-sm font-semibold transition",
            ready && !busy
              ? "raised bg-violet text-white hover:bg-violet-bright"
              : "cursor-not-allowed bg-slate text-faint",
          )}
        >
          {busy ? "Sorgulanıyor..." : "Sorgula"}
        </button>
      </form>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="label">Örnek araçlar</span>
        {EXAMPLES.map((example) => (
          <button
            key={example.vin}
            type="button"
            onClick={() => setVin(example.vin)}
            className="rounded-full border border-violet/20 bg-ink/40 px-3 py-1.5 text-xs text-muted transition hover:border-violet/50 hover:text-bright"
          >
            {example.label}
          </button>
        ))}
      </div>
    </div>
  );
}
