import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, Fingerprint, Store, Wrench } from "lucide-react";

import { Brand } from "@/components/brand";
import { ScoreGauge } from "@/components/score-gauge";
import { Timeline } from "@/components/timeline";
import { explorerAddress } from "@/lib/chain";
import { registryAddress } from "@/lib/registry";
import { loadVehicle } from "@/lib/server";
import { formatDate, formatKm } from "@/lib/utils";

type Props = { params: Promise<{ vin: string }> };

/** The chain is the source; don't serve a history from yesterday's cache. */
export const revalidate = 0;

export async function generateMetadata({ params }: Props) {
  const { vin } = await params;
  return { title: `${decodeURIComponent(vin)} — MonadDrive` };
}

export default async function VehiclePage({ params }: Props) {
  const { vin } = await params;
  const vehicle = await loadVehicle(decodeURIComponent(vin));

  if (!vehicle) notFound();

  const { summary, records, garages, image, tokenId } = vehicle;
  const firstRecord = records[records.length - 1];

  return (
    <main className="mx-auto w-full max-w-6xl px-6 pb-20 pt-6">
      <header className="mb-10 flex items-center justify-between gap-4">
        <Brand />
        <Link
          href="/"
          className="text-sm text-muted underline-offset-4 transition hover:text-bright hover:underline"
        >
          Yeni sorgu
        </Link>
      </header>

      {/* --- identity ------------------------------------------------------ */}
      <section className="glass glass-lit overflow-hidden">
        <div className="grid gap-8 p-7 md:grid-cols-[auto_1fr_auto] md:items-center md:p-9">
          {image ? (
            <Image
              src={image}
              alt="Aracın zincirde üretilen NFT görseli"
              width={168}
              height={168}
              unoptimized
              className="mx-auto rounded-2xl border border-violet/25"
            />
          ) : (
            <div className="mx-auto size-[168px] rounded-2xl border border-violet/25 bg-ink" />
          )}

          <div className="min-w-0 text-center md:text-left">
            <p className="label">Şasi numarası</p>
            <h1 className="numeric mt-1.5 break-all text-2xl font-semibold tracking-[0.06em] text-bright sm:text-3xl">
              {vehicle.vin}
            </h1>

            <p className="numeric mt-9 text-5xl font-semibold leading-none text-bright sm:text-6xl">
              {formatKm(summary.lastMileage)}
              <span className="ml-2 text-xl font-normal text-muted">km</span>
            </p>
            <p className="mt-2 text-sm text-faint">
              Son güncelleme {formatDate(summary.lastUpdatedAt)}
            </p>

            <div className="mt-6 flex flex-wrap justify-center gap-2 md:justify-start">
              <Badge icon={Fingerprint} tone="violet">
                dNFT #{tokenId.toString(16).slice(0, 8)}
              </Badge>
              {summary.accidentCount > 0 ? (
                <Badge icon={AlertTriangle} tone="danger">
                  {summary.accidentCount} kaza kaydı
                </Badge>
              ) : (
                <Badge icon={Wrench} tone="neon">
                  Kaza kaydı yok
                </Badge>
              )}
            </div>
          </div>

          <ScoreGauge score={summary.healthScore} className="mx-auto" />
        </div>
      </section>

      {/* --- trust card + timeline ----------------------------------------- */}
      <div className="mt-6 grid gap-6 lg:grid-cols-[320px_1fr]">
        <aside className="space-y-6">
          <section className="glass p-6">
            <h2 className="text-sm font-semibold text-bright">Güven kartı</h2>
            <dl className="mt-5 space-y-4">
              <Stat label="Toplam kayıt" value={String(summary.recordCount)} />
              <Stat label="Farklı servis" value={String(garages.size)} />
              <Stat
                label="Kaza kaydı"
                value={summary.accidentCount > 0 ? String(summary.accidentCount) : "Yok"}
                tone={summary.accidentCount > 0 ? "danger" : "neon"}
              />
              {firstRecord && (
                <Stat label="Sicile giriş" value={formatDate(firstRecord.serviceDay * 86_400)} />
              )}
            </dl>
          </section>

          <section className="glass p-6">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-bright">
              <Store className="size-4 text-violet-bright" />
              Geçmişi yazanlar
            </h2>
            <ul className="mt-4 space-y-3">
              {[...garages.values()].map((garage) => (
                <li key={garage.address}>
                  <a
                    href={explorerAddress(garage.address)}
                    target="_blank"
                    rel="noreferrer"
                    className="group block"
                  >
                    <p className="text-sm text-bright transition group-hover:text-violet-bright">
                      {garage.name}
                    </p>
                    <p className="numeric text-xs text-faint">
                      {garage.address.slice(0, 10)}...{garage.address.slice(-6)}
                    </p>
                  </a>
                </li>
              ))}
            </ul>
            <p className="mt-5 text-xs leading-relaxed text-faint">
              Yetkisi alınan bir servisin yazdığı kayıtlar da yerinde kalır. Geçmiş
              yalnızca eklenir, hiçbir koşulda silinmez.
            </p>
          </section>
        </aside>

        <section>
          <h2 className="mb-5 text-sm font-semibold text-bright">
            Servis geçmişi
            <span className="ml-2 font-normal text-faint">
              {summary.recordCount} kayıt, en yeniden eskiye
            </span>
          </h2>
          <Timeline records={records} garages={garages} />
        </section>
      </div>

      <footer className="mt-16 text-center">
        <a
          href={explorerAddress(registryAddress)}
          target="_blank"
          rel="noreferrer"
          className="numeric text-xs text-faint underline-offset-4 transition hover:text-violet-bright hover:underline"
        >
          Sicil kontratı {registryAddress}
        </a>
      </footer>
    </main>
  );
}

// --- pieces -----------------------------------------------------------------

function Stat({
  label,
  value,
  tone = "bright",
}: {
  label: string;
  value: string;
  tone?: "bright" | "neon" | "danger";
}) {
  const color =
    tone === "neon" ? "text-neon" : tone === "danger" ? "text-danger" : "text-bright";

  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className={`numeric text-sm font-medium ${color}`}>{value}</dd>
    </div>
  );
}

function Badge({
  icon: Icon,
  tone,
  children,
}: {
  icon: typeof Wrench;
  tone: "violet" | "neon" | "danger";
  children: React.ReactNode;
}) {
  const styles = {
    violet: "border-violet/40 bg-violet/15 text-violet-bright",
    neon: "border-neon/35 bg-neon/10 text-neon",
    danger: "border-danger/40 bg-danger/10 text-danger",
  }[tone];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium ${styles}`}
    >
      <Icon className="size-3.5" />
      {children}
    </span>
  );
}
