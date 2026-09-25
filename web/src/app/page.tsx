import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { formatEther } from "viem";

import {
  ActionsBar,
  DocHead,
  PageFoot,
  SectionHeading,
  TopBand,
} from "@/components/datasheet";
import { RegistrySchematic } from "@/components/registry-schematic";
import { VinSearch } from "@/components/vin-search";
import { explorerAddress } from "@/lib/chain";
import { registryAddress } from "@/lib/registry";
import { loadRegistryInfo } from "@/lib/server";
import { shortAddress } from "@/lib/utils";

/** Terms are read from the chain, so the table never quotes a stale price. */
export const revalidate = 30;

export default async function HomePage() {
  const { priceWei, platformShareBps } = await loadRegistryInfo();
  const price = formatEther(BigInt(priceWei));
  const platformPct = platformShareBps / 100;

  return (
    <>
      <TopBand current="search" />
      <DocHead
        tag="Ürün önizlemesi"
        meta={[
          <span key="id" className="numeric">
            MDVR001A
          </span>,
          "Eylül 2026",
          "Monad Testnet üzerinde",
        ]}
        partno="MDV-1"
        partnoSub="Araç sicil birimi"
      />
      <ActionsBar />

      <main>
        {/* --- hero ------------------------------------------------------ */}
        <section className="wrap grid gap-12 py-[clamp(40px,6vw,72px)] lg:grid-cols-[minmax(0,1fr)_minmax(0,1.08fr)] lg:gap-16">
          <div>
            <h1 className="display mb-7 text-[clamp(38px,4.6vw,66px)]">
              İkinci el araçta kelimeye değil, <em>kayda bakın.</em>
            </h1>

            <VinSearch />

            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/report" className="btn">
                Usta paneline geç
                <ArrowRight className="size-4" strokeWidth={2} />
              </Link>
              <a href="#aciklama" className="btn btn-ghost">
                Nasıl çalışır
              </a>
            </div>

            <div className="mt-11">
              <SectionHeading n={1}>Özellikler</SectionHeading>
              <ul className="features">
                <li>
                  <b>Kilometre geri alınamaz:</b> düşük değer girme denemesi bir uyarı değil,
                  zincirin baştan reddettiği bir işlemdir
                </li>
                <li>
                  <b>Geçmiş silinemez:</b> kayıtlar yalnızca eklenir; yetkisi alınan servisin
                  imzaladıkları yerinde kalır
                </li>
                <li>
                  <b>Kaynağı belli:</b> her kaydın altında onu imzalayan servisin adı ve adresi
                </li>
                <li>
                  <b>Saniyenin altında onay:</b> sanayideki usta kaydı telefonundan girer, Monad
                  onu ~700 ms’de kesinleştirir
                </li>
                <li>
                  <b>Okuyan öder, yazan kazanır:</b> rapor ücretinin %{100 - platformPct}’i
                  geçmişi yazan servislere gider
                </li>
              </ul>
            </div>
          </div>

          <div className="lg:pt-2">
            <RegistrySchematic />
          </div>
        </section>

        {/* --- applications, description, device table -------------------- */}
        <section className="wrap border-t border-hair pb-[clamp(40px,5vw,64px)] pt-9">
          <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-[1fr_1.15fr_1.2fr]">
            <div>
              <SectionHeading n={2}>Kimler için</SectionHeading>
              <ul className="dashes columns-2 gap-6 md:columns-1 xl:columns-2">
                <li>İkinci el alıcılar</li>
                <li>Galeriler</li>
                <li>Servisler ve ustalar</li>
                <li>Ekspertiz firmaları</li>
                <li>Sigorta şirketleri</li>
                <li>Filo yöneticileri</li>
              </ul>
            </div>

            <div id="aciklama">
              <SectionHeading n={3}>Açıklama</SectionHeading>
              <div className="space-y-3 text-[15px] leading-relaxed text-ink-2">
                <p>
                  MonadDrive her aracı tek bir <b className="text-ink">dinamik NFT</b> olarak
                  sicile yazar. Token kimliği şasi numarasından türetilir; camdaki numarayı
                  bilen herkes aracı sorgular, ama numaranın kendisi zincire hiç yazılmaz.
                </p>
                <p>
                  Usta işi bitirince kaydı girer. Kilometre bir önceki değerin altına
                  inemez, kaza kaydı silinemez, ve her satırın arkasında imzalayan servis
                  durur. Alıcı önizlemeyi ücretsiz görür, tam raporu açınca öder.
                </p>
              </div>
            </div>

            <div className="md:col-span-2 lg:col-span-1">
              <div className="tbl-wrap">
                <table className="ds">
                  <caption>
                    <span className="cap-n">Tablo 1.</span> Sicil bilgisi
                  </caption>
                  <thead>
                    <tr>
                      <th>Parametre</th>
                      <th>Değer</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Ağ</td>
                      <td className="numeric text-ink">Monad Testnet · 10143</td>
                    </tr>
                    <tr>
                      <td>Sicil kontratı</td>
                      <td>
                        <a
                          href={explorerAddress(registryAddress)}
                          target="_blank"
                          rel="noreferrer"
                          className="numeric text-ink underline decoration-hair underline-offset-4 hover:decoration-red"
                        >
                          {shortAddress(registryAddress)}
                        </a>
                      </td>
                    </tr>
                    <tr className="hl">
                      <td>Rapor ücreti</td>
                      <td className="numeric font-semibold">{price} MON</td>
                    </tr>
                    <tr>
                      <td>Bölüşüm</td>
                      <td className="numeric text-ink">
                        %{platformPct} platform · %{100 - platformPct} servis
                      </td>
                    </tr>
                    <tr>
                      <td>Onay süresi</td>
                      <td className="numeric text-ink">~700 ms (medyan)</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>
      </main>

      <PageFoot id="Monad Testnet, Eylül 2026" page={1} />

      {/* --- the dark band a datasheet closes on --------------------------- */}
      <section className="close-band">
        <div className="wrap grid gap-10 py-[clamp(56px,7vw,96px)] lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)] lg:items-end">
          <h2 className="display text-[clamp(40px,5.2vw,72px)]">
            Aracın geçmişini satıcı değil, <em>zincir anlatsın.</em>
          </h2>
          <div>
            <p className="mb-7 max-w-[48ch] text-[17px] text-[#c4c4bd]">
              Şasi numarasını yazın; kilometreyi, kaza kaydını ve kaç servisin
              dokunduğunu hemen görün. Tam rapor tek seferlik ödemeyle cüzdanınızda
              kalıcı olarak açılır.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/vehicle/1HGBH41JXMN109186"
                className="btn border-[#f2f2ee] bg-[#f2f2ee] text-ink hover:border-red hover:bg-red hover:text-white"
              >
                Örnek raporu aç
                <ArrowRight className="size-4" strokeWidth={2} />
              </Link>
              <Link
                href="/report"
                className="btn btn-ghost border-[#f2f2ee] text-[#f2f2ee] hover:bg-[#f2f2ee] hover:text-ink"
              >
                Usta paneli
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
