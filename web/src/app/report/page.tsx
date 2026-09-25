import { DocHead, PageFoot, TopBand } from "@/components/datasheet";
import { EarningsCard } from "@/components/earnings-card";
import { ReportForm } from "@/components/report-form";

export const metadata = {
  title: "Kayıt gir — MonadDrive",
};

/**
 * The garage screen. Built for a phone held in one hand in a workshop: one
 * column, large targets, and a single button that ends the job.
 */
export default function ReportPage() {
  return (
    <>
      <TopBand current="report" />
      <DocHead
        tag="Servis kayıt formu"
        meta={["Yalnızca onaylı servisler", "Monad Testnet"]}
        partno="SKF-1"
        partnoSub="Usta paneli"
      />

      <main className="wrap pb-[clamp(48px,6vw,80px)] pt-[clamp(32px,5vw,56px)]">
        <div className="mx-auto max-w-[560px]">
          <h1 className="display text-[clamp(34px,4.4vw,54px)]">
            Servis kaydı <em>gir.</em>
          </h1>
          <p className="mb-10 mt-4 text-[16px] text-ink-2">
            Girdiğiniz kayıt saniyeler içinde zincire yazılır ve bir daha değiştirilemez.
          </p>

          <EarningsCard />
          <ReportForm />
        </div>
      </main>

      <PageFoot id="Servis kayıt formu" page={1} />
    </>
  );
}
