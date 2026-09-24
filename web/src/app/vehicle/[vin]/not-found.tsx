import { FileQuestion } from "lucide-react";

import { Brand } from "@/components/brand";
import { VinSearch } from "@/components/vin-search";

/**
 * An unknown VIN is not an error. It is the honest answer to a fair question,
 * and it still tells the buyer something: nobody has put this car on the
 * registry yet.
 */
export default function VehicleNotFound() {
  return (
    <main className="mx-auto w-full max-w-2xl px-6 pb-20 pt-6">
      <header className="mb-20">
        <Brand />
      </header>

      <div className="flex flex-col items-center text-center">
        <div className="glass flex size-16 items-center justify-center rounded-2xl">
          <FileQuestion className="size-7 text-violet-bright" />
        </div>

        <h1 className="mt-6 text-2xl font-semibold text-bright">
          Bu araç sicile kayıtlı değil
        </h1>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-muted">
          Girdiğiniz şasi numarası için zincirde bir kayıt bulunamadı. Bu, aracın
          geçmişinin temiz olduğu anlamına gelmez — yalnızca henüz hiçbir servisin
          bu aracı sicile girmediğini gösterir.
        </p>

        <div className="mt-10 w-full">
          <VinSearch />
        </div>
      </div>
    </main>
  );
}
