import { notFound } from "next/navigation";

import { DocHead, PageFoot, SectionHeading, TopBand } from "@/components/datasheet";
import { FullReport } from "@/components/full-report";
import { VehicleImage, VehicleScore } from "@/components/vehicle-badge";
import { explorerAddress } from "@/lib/chain";
import { registryAddress } from "@/lib/registry";
import { loadVehiclePreview } from "@/lib/server";
import { cn, formatDate, formatKm, shortAddress } from "@/lib/utils";

type Props = { params: Promise<{ vin: string }> };

/** The chain is the source; don't serve a history from yesterday's cache. */
export const revalidate = 0;

export async function generateMetadata({ params }: Props) {
  const { vin } = await params;
  return { title: `${decodeURIComponent(vin)} — MonadDrive sicil raporu` };
}

/**
 * One vehicle, as a datasheet: part number, revision, a device table, figures.
 *
 * Everything on this server-rendered page is the free preview. The score, the
 * dNFT image and the record-by-record history are read in the browser only
 * after the chain says the viewer has access, so none of it is in the source.
 */
export default async function VehiclePage({ params }: Props) {
  const { vin } = await params;
  const vehicle = await loadVehiclePreview(decodeURIComponent(vin));

  if (!vehicle) notFound();

  const { summary, tokenId } = vehicle;
  const records = Number(summary.recordCount);
  const accidents = Number(summary.accidentCount);
  const nftId = tokenId.toString(16).slice(0, 8);

  return (
    <>
      <TopBand />
      <DocHead
        tag="Araç sicil raporu"
        meta={[
          <span key="vin" className="numeric">
            {vehicle.vin}
          </span>,
          `Rev. ${records} kayıt`,
          `Son güncelleme ${formatDate(summary.lastUpdatedAt)}`,
        ]}
        partno={
          <>
            {formatKm(summary.lastMileage)}
            <span className="ml-1.5 text-[0.4em] font-bold tracking-normal text-ink-3">km</span>
          </>
        }
        partnoSub="Güncel kilometre"
      />

      <main className="wrap pb-[clamp(48px,6vw,80px)]">
        {/* --- identity and summary ----------------------------------------- */}
        <section className="grid gap-12 py-[clamp(36px,5vw,60px)] lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:gap-16">
          <div>
            <h1 className="display break-all text-[clamp(34px,4.4vw,60px)]">{vehicle.vin}</h1>
            <p className="mb-9 mt-4 text-[16px] text-ink-2">
              Bu şasi numarasıyla sicile kayıtlı araç.{" "}
              {accidents > 0 ? (
                <b className="text-red">
                  {accidents} kaza kaydı taşıyor.
                </b>
              ) : (
                <b className="text-green">Kaza kaydı yok.</b>
              )}
            </p>

            <SectionHeading n={1}>Özet</SectionHeading>
            <div className="tbl-wrap">
              <table className="ds">
                <caption>
                  <span className="cap-n">Tablo 1.</span> Araç bilgisi
                </caption>
                <thead>
                  <tr>
                    <th>Parametre</th>
                    <th>Değer</th>
                    <th>Kaynak</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Şasi numarası</td>
                    <td className="numeric break-all text-ink">{vehicle.vin}</td>
                    <td className="numeric text-[12.5px]">keccak256 → token</td>
                  </tr>
                  <tr>
                    <td>Kilometre</td>
                    <td className="numeric text-ink">{formatKm(summary.lastMileage)} km</td>
                    <td className="numeric text-[12.5px]">son kayıt</td>
                  </tr>
                  <tr>
                    <td>Kayıt sayısı</td>
                    <td className="numeric text-ink">{records}</td>
                    <td className="numeric text-[12.5px]">yalnızca eklenir</td>
                  </tr>
                  <tr className={cn(accidents > 0 && "hl")}>
                    <td>Kaza kaydı</td>
                    <td className={cn("numeric font-semibold", accidents > 0 ? "text-red" : "text-green")}>
                      {accidents > 0 ? accidents : "Yok"}
                    </td>
                    <td className="numeric text-[12.5px]">silinemez</td>
                  </tr>
                  <tr>
                    <td>Son güncelleme</td>
                    <td className="numeric text-ink">{formatDate(summary.lastUpdatedAt)}</td>
                    <td className="numeric text-[12.5px]">blok zamanı</td>
                  </tr>
                  <tr>
                    <td>dNFT</td>
                    <td className="numeric text-ink">#{nftId}</td>
                    <td className="numeric text-[12.5px]">ERC-721</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-[12.5px] text-ink-3">
              Yukarıdakiler herkese açık önizleme. Sağlık skoru ve kayıt kayıt geçmiş tam
              raporda.
            </p>
          </div>

          <div className="space-y-10">
            <VehicleImage tokenId={tokenId.toString()} />
            <div className="max-w-[420px]">
              <VehicleScore tokenId={tokenId.toString()} />
            </div>
          </div>
        </section>

        <div className="border-t border-hair pt-10">
          <FullReport
            tokenId={tokenId.toString()}
            priceWei={vehicle.priceWei}
            garageCount={vehicle.garageCount}
            garageShareBps={vehicle.garageShareBps}
          />
        </div>
      </main>

      <PageFoot
        id={
          <>
            <span className="numeric">{vehicle.vin}</span> ·{" "}
            <a
              href={explorerAddress(registryAddress)}
              target="_blank"
              rel="noreferrer"
              className="numeric hover:text-ink"
            >
              {shortAddress(registryAddress)}
            </a>
          </>
        }
        page={1}
      />
    </>
  );
}
