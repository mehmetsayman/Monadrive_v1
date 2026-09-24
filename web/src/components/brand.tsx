import Link from "next/link";

import { cn } from "@/lib/utils";

/** The mark: a violet chevron road narrowing to a point, with the wordmark. */
export function Brand({
  className,
  href = "/",
}: {
  className?: string;
  href?: string;
}) {
  return (
    <Link
      href={href}
      className={cn("group inline-flex items-center gap-2.5", className)}
    >
      <svg viewBox="0 0 24 24" className="size-6" aria-hidden="true">
        <path
          d="M4 20 L12 3 L20 20 L12 15 Z"
          fill="none"
          stroke="var(--color-violet)"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <path d="M12 15 L12 3" stroke="var(--color-neon)" strokeWidth="1.6" />
      </svg>
      <span className="text-[0.95rem] font-semibold tracking-[0.18em] text-bright">
        MONAD<span className="text-violet-bright">DRIVE</span>
      </span>
    </Link>
  );
}
