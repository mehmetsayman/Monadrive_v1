import { Brand } from "@/components/brand";
import { ReportForm } from "@/components/report-form";
import { WalletButton } from "@/components/wallet-button";

export const metadata = {
  title: "Kayıt gir — MonadDrive",
};

/**
 * The garage screen. Built for a phone held in one hand in a workshop: one
 * column, large targets, and a single button that ends the job.
 */
export default function ReportPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col px-5 pb-12 pt-6">
      <header className="mb-8 flex items-center justify-between gap-4">
        <Brand />
        <WalletButton />
      </header>

      <div className="mb-7">
        <h1 className="text-2xl font-semibold tracking-tight text-bright">
          Servis kaydı gir
        </h1>
        <p className="mt-1.5 text-sm text-muted">
          Girdiğiniz kayıt saniyeler içinde zincire yazılır ve bir daha değiştirilemez.
        </p>
      </div>

      <ReportForm />
    </main>
  );
}
