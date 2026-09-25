import { scoreTone } from "@/lib/registry";
import { cn } from "@/lib/utils";

const TONE_STROKE = {
  good: "var(--color-neon)",
  warn: "var(--color-amber)",
  bad: "var(--color-danger)",
  neutral: "var(--color-violet)",
} as const;

const VERDICT = {
  good: "Temiz geçmiş",
  warn: "Dikkatli inceleyin",
  bad: "Ağır hasar kaydı",
  neutral: "—",
} as const;

/** The score as a ring. One number, one colour, one sentence. */
export function ScoreGauge({ score, className }: { score: number; className?: string }) {
  const tone = scoreTone(score);
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const filled = (Math.min(Math.max(score, 0), 100) / 100) * circumference;

  return (
    <div className={cn("flex flex-col items-center gap-3", className)}>
      <div className="relative size-[132px]">
        <svg viewBox="0 0 132 132" className="size-full -rotate-90">
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
            stroke={TONE_STROKE[tone]}
            strokeWidth="9"
            strokeLinecap="round"
            strokeDasharray={`${filled} ${circumference}`}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className="numeric text-4xl font-semibold leading-none"
            style={{ color: TONE_STROKE[tone] }}
          >
            {score}
          </span>
          <span className="numeric mt-1 text-xs text-faint">/ 100</span>
        </div>
      </div>
      <p className="text-sm font-medium" style={{ color: TONE_STROKE[tone] }}>
        {VERDICT[tone]}
      </p>
    </div>
  );
}
