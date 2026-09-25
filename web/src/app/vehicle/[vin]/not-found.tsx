import { DocHead, PageFoot, SectionHeading, TopBand } from "@/components/datasheet";
import { VinSearch } from "@/components/vin-search";

/**
 * An unknown VIN is not an error. It is the honest answer to a fair question,
 * and it still tells the buyer something: nobody has put this car on the
 * registry yet.
 */
export default function VehicleNotFound() {
  return (
    <>
      <TopBand />
      <DocHead
        tag="Kayıt bulunamadı"
        meta={["Sorgu sonucu", "Monad Testnet"]}
        partno="—"
        partnoSub="Sicilde değil"
      />

      <main className="wrap py-[clamp(48px,7vw,96px)]">
        <div className="max-w-[640px]">
          <h1 className="display text-[clamp(34px,4.4vw,58px)]">
            Bu araç <em>sicilde yok.</em>
          </h1>

          <div className="mt-6 border-l-[3px] border-red bg-red-wash px-4 py-3 text-[15px] text-ink">
            Bu, aracın geçmişinin temiz olduğu anlamına <b>gelmez</b> — yalnızca henüz
            hiçbir servisin onu sicile girmediğini gösterir.
          </div>

          <div className="mt-11">
            <SectionHeading n={1}>Başka bir şasi numarası deneyin</SectionHeading>
            <VinSearch autoFocus />
          </div>
        </div>
      </main>

      <PageFoot id="Sorgu sonucu" page={1} />
    </>
  );
}
