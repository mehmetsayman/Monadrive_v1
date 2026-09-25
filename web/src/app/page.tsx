import Link from "next/link";
import { ArrowRight, Gauge, ScrollText, ShieldCheck } from "lucide-react";

import { Brand } from "@/components/brand";
import { VinSearch } from "@/components/vin-search";
import { WalletButton } from "@/components/wallet-button";
import { explorerAddress } from "@/lib/chain";
import { registryAddress } from "@/lib/registry";
import { shortAddress } from "@/lib/utils";

const PROMISES = [
  {
    icon: Gauge,
    title: "Kilometre geri alınamaz",
    body: "Düşük kilometre girme denemesi bir uyarı değil, hiç gerçekleşmeyen bir işlemdir. Zincir onu baştan reddeder.",
  },
  {
    icon: ScrollText,
    title: "Geçmiş silinemez",
    body: "Kayıtlar yalnızca eklenir. Bir servisin yetkisi alınsa bile imzaladığı geçmiş yerinde kalır.",
  },
  {
    icon: ShieldCheck,
    title: "Kaynağı belli",
    body: "Her satırın altında onu yazan servisin adresi durur. Aracın geçmişini kimin anlattığı da kayıt altındadır.",
  },
];

export default function HomePage() {
  return (
    <main className="mx-auto w-full max-w-5xl px-6 pb-20 pt-6">
      <header className="mb-20 flex items-center justify-between gap-4">
        <Brand />
        <WalletButton />
      </header>

      <section className="mx-auto max-w-3xl text-center">
        <h1 className="text-4xl font-semibold leading-[1.1] tracking-tight text-bright sm:text-6xl">
          İkinci el araçta
          <br />
          <span className="text-violet-bright">kelimeye değil</span>, kayda bakın.
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-muted">
          Her araç bir dinamik NFT. Servis geçmişi doğduğu günden bugüne Monad
          üzerinde duruyor — sanayideki usta telefonundan giriyor, alıcı saniyeler içinde
          görüyor. Raporu okuyan öder, geçmişi yazan usta kazanır.
        </p>

        <div className="mt-10">
          <VinSearch />
        </div>

        <Link
          href="/report"
          className="mt-8 inline-flex items-center gap-2 text-sm text-muted underline-offset-4 transition hover:text-violet-bright hover:underline"
        >
          Servis misiniz? Usta paneline geçin
          <ArrowRight className="size-4" />
        </Link>
      </section>

      <section className="mt-24 grid gap-4 sm:grid-cols-3">
        {PROMISES.map(({ icon: Icon, title, body }) => (
          <article key={title} className="glass p-6">
            <Icon className="size-5 text-violet-bright" />
            <h2 className="mt-4 text-base font-semibold text-bright">{title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">{body}</p>
          </article>
        ))}
      </section>

      <footer className="mt-20 flex flex-col items-center gap-2 text-center">
        <p className="label">Sicil kontratı</p>
        <a
          href={explorerAddress(registryAddress)}
          target="_blank"
          rel="noreferrer"
          className="numeric text-sm text-muted underline-offset-4 transition hover:text-violet-bright hover:underline"
        >
          {shortAddress(registryAddress)}
        </a>
      </footer>
    </main>
  );
}
