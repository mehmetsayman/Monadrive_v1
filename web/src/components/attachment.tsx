"use client";

import { FileText } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";

const IPFS_GATEWAY =
  process.env.NEXT_PUBLIC_IPFS_GATEWAY ?? "https://gateway.pinata.cloud/ipfs";

/**
 * A record's photo or invoice, shown as the thing itself rather than a word.
 *
 * It used to be a small "Belge" link at the end of the metadata line, and people
 * could not find it - the one piece of a record a buyer most wants to see was
 * the easiest to miss. So it is a thumbnail.
 *
 * The CID does not say what kind of file it points at, so this tries it as an
 * image first. A PDF, or anything a browser cannot draw, falls back to a plain
 * link rather than a broken picture.
 */
export function Attachment({ cid, compact = false }: { cid: string; compact?: boolean }) {
  const [notAnImage, setNotAnImage] = useState(false);
  const href = `${IPFS_GATEWAY}/${cid}`;

  if (notAnImage) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="mt-2 inline-flex items-center gap-1.5 border border-ink px-2 py-1 text-[12px] font-semibold text-ink transition hover:bg-ink hover:text-white"
      >
        <FileText className="size-3.5" />
        Belgeyi aç
      </a>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="group mt-2 inline-block"
      title="Tam boyutta aç"
    >
      {/* A plain img on purpose: the file lives on an IPFS gateway, not on this
          origin, and next/image would need that host allow-listed and would
          re-encode a document that is meant to be seen as it was signed. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={href}
        alt="Kayda eklenen fotoğraf"
        loading="lazy"
        decoding="async"
        onError={() => setNotAnImage(true)}
        className={cn(
          "block w-auto max-w-full border-[1.5px] border-ink object-cover transition group-hover:border-red",
          compact ? "h-16" : "h-32",
        )}
      />
    </a>
  );
}
