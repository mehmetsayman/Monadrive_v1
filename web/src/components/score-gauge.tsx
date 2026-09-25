import { Lock } from "lucide-react";

import { scoreTone } from "@/lib/registry";
import { cn } from "@/lib/utils";

const TONE = {
  good: { fill: "bg-green", text: "text-green", verdict: "Temiz geçmiş" },
  warn: { fill: "bg-amber", text: "text-amber", verdict: "Dikkatli inceleyin" },
  bad: { fill: "bg-red", text: "text-red", verdict: "Ağır hasar kaydı" },
  neutral: { fill: "bg-ink", text: "text-ink", verdict: "—" },
} as const;

/** The two thresholds the verdict changes at, drawn as ticks on the scale. */
const TICKS = [0, 50, 80, 100];

/**
 * The health score as a datasheet draws a value against its range: a ruled bar
 * with the thresholds marked, rather than a ring. A ring is decoration; a scale
 * tells you where 53 sits between the lines that matter.
 */
export function ScoreBar({ score }: { score: number }) {
  const tone = TONE[scoreTone(score)];
  const clamped = Math.min(Math.max(score, 0), 100);

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-4">
        <span className="label">Sağlık skoru</span>
        <span className="numeric text-[15px] text-ink-3">
          <span className={cn("partno text-[40px]", tone.text)}>{score}</span> / 100
        </span>
      </div>
      <Scale>
        <div className={cn("h-full", tone.fill)} style={{ width: `${clamped}%` }} />
      </Scale>
      <p className={cn("mt-3 text-[14px] font-semibold", tone.text)}>{tone.verdict}</p>
    </div>
  );
}

/** Same scale, empty, with the number withheld. */
export function LockedScoreBar() {
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-4">
        <span className="label">Sağlık skoru</span>
        <span className="numeric flex items-center gap-2 text-[15px] text-ink-3">
          <Lock className="size-4 text-red" strokeWidth={2} />
          <span className="partno text-[40px] text-ink-3">?</span> / 100
        </span>
      </div>
      <Scale>
        {/* Hatched: the value exists, it is just not shown. */}
        <div
          className="h-full w-full"
          style={{
            backgroundImage:
              "repeating-linear-gradient(135deg, #e6e6e1 0 6px, transparent 6px 12px)",
          }}
        />
      </Scale>
      <p className="mt-3 text-[14px] font-semibold text-red">Tam raporda açılır</p>
    </div>
  );
}

function Scale({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <div className="relative h-5 border-[1.5px] border-ink bg-white">{children}</div>
      <div className="relative mt-1 h-4">
        {TICKS.map((tick) => (
          <span
            key={tick}
            className="numeric absolute -translate-x-1/2 text-[11px] text-ink-3"
            style={{ left: `${tick}%` }}
          >
            {tick}
          </span>
        ))}
      </div>
    </div>
  );
}
