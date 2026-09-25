import Link from "next/link";
import type { ReactNode } from "react";
import { BookOpen, FileCode2, Search, ShieldCheck, Wrench } from "lucide-react";

import { explorerAddress } from "@/lib/chain";
import { registryAddress } from "@/lib/registry";

import { WalletButton } from "./wallet-button";

/*
 * The furniture of a datasheet page, shared by every screen: the red band on
 * top, the document head with its part number, the row of document links, and
 * the running foot. Pages supply the words; this supplies the form.
 */

const SOURCIFY = `https://sourcify.dev/server/repo-ui/10143/${registryAddress}`;

/** The chip glyph: an IC package seen from above. */
export function ChipMark({ className = "size-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <rect x="5.5" y="5.5" width="13" height="13" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="8.5" cy="8.5" r="1" fill="currentColor" />
      {[8, 12, 16].map((p) => (
        <g key={p} stroke="currentColor" strokeWidth="1.6">
          <path d={`M${p} 2v3.5M${p} 18.5V22M2 ${p}h3.5M18.5 ${p}H22`} />
        </g>
      ))}
    </svg>
  );
}

/** The solid red band across the top of every page. */
export function TopBand({ current }: { current?: "search" | "report" }) {
  const links = [
    { href: "/", label: "Sorgula", key: "search" },
    { href: "/report", label: "Usta paneli", key: "report" },
  ] as const;

  return (
    <div className="bg-red text-white">
      <div className="wrap flex h-[54px] items-center gap-6 sm:gap-7">
        <Link href="/" className="flex shrink-0 items-center gap-2.5 text-white">
          <ChipMark className="size-6" />
          <span
            className="text-[17px] font-extrabold tracking-[0.14em]"
            style={{ fontVariationSettings: '"wdth" 110' }}
          >
            MONADDRIVE
          </span>
        </Link>

        <nav className="hidden items-center gap-5 text-[14.5px] md:flex" aria-label="Ana menü">
          {links.map((link) => (
            <Link
              key={link.key}
              href={link.href}
              aria-current={current === link.key ? "page" : undefined}
              className={
                current === link.key
                  ? "font-semibold text-white underline decoration-2 underline-offset-[6px]"
                  : "text-white/85 transition hover:text-white"
              }
            >
              {link.label}
            </Link>
          ))}
          <a
            href={explorerAddress(registryAddress)}
            target="_blank"
            rel="noreferrer"
            className="text-white/85 transition hover:text-white"
          >
            Kontrat
          </a>
        </nav>

        <div className="ml-auto">
          <WalletButton variant="on-red" />
        </div>
      </div>
    </div>
  );
}

/**
 * The head of a document: an outlined tag, a line of metadata, and a part
 * number set large on the right.
 */
export function DocHead({
  tag,
  meta,
  partno,
  partnoSub,
}: {
  tag: string;
  meta: ReactNode[];
  partno: ReactNode;
  partnoSub: ReactNode;
}) {
  return (
    <div className="border-b-[1.5px] border-ink">
      <div className="wrap grid grid-cols-1 items-end gap-5 pb-3 pt-6 sm:grid-cols-[1fr_auto]">
        <div className="flex flex-wrap items-center gap-x-[18px] gap-y-1.5 text-[12.5px] text-ink-2">
          <span className="tag">{tag}</span>
          {meta.map((item, index) => (
            <span key={index}>{item}</span>
          ))}
        </div>
        <div className="sm:text-right">
          <p className="partno text-[clamp(34px,4.4vw,54px)]">{partno}</p>
          <p
            className="mt-1.5 text-[12px] font-medium tracking-[0.04em] text-ink-3"
            style={{ fontVariationSettings: '"wdth" 100' }}
          >
            {partnoSub}
          </p>
        </div>
      </div>
    </div>
  );
}

/** The row of document links under the head, divided by hairlines. */
export function ActionsBar() {
  const items = [
    { href: "/", label: "Araç sorgula", icon: Search, external: false },
    { href: "/report", label: "Usta paneli", icon: Wrench, external: false },
    { href: explorerAddress(registryAddress), label: "Sicil kontratı", icon: FileCode2, external: true },
    { href: SOURCIFY, label: "Doğrulanmış kaynak", icon: ShieldCheck, external: true },
    {
      href: "https://github.com/mehmetsayman/Monadrive_v1",
      label: "Belgeler",
      icon: BookOpen,
      external: true,
    },
  ];

  return (
    <div className="border-b border-hair bg-paper-2">
      <div className="wrap">
        <ul className="flex flex-wrap">
          {items.map(({ href, label, icon: Icon, external }, index) => (
            <li
              key={label}
              className={`border-r border-hair ${index === 0 ? "border-l" : ""}`}
            >
              <a
                href={href}
                {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
                className="flex items-center gap-2.5 px-[18px] py-3 text-[14px] font-semibold text-ink transition hover:bg-band"
              >
                <Icon className="size-4 text-red" strokeWidth={1.8} />
                {label}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** "3  Description" */
export function SectionHeading({
  n,
  children,
  as: Tag = "h2",
}: {
  n: string | number;
  children: ReactNode;
  as?: "h2" | "h3";
}) {
  return (
    <Tag className="sec-h">
      <span className="n">{n}</span>
      {children}
    </Tag>
  );
}

/** The running foot of a datasheet page. */
export function PageFoot({ id, page }: { id: ReactNode; page: number }) {
  return (
    <div className="pagefoot">
      <div className="wrap">
        <span>
          <b>MDV-1</b> · {id}
        </span>
        <a
          href="https://github.com/mehmetsayman/Monadrive_v1/issues"
          target="_blank"
          rel="noreferrer"
          className="hidden transition hover:text-ink sm:inline"
        >
          Belge hakkında geri bildirim
        </a>
        <span className="numeric text-ink">{page}</span>
      </div>
    </div>
  );
}
