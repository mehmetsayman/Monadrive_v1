"use client";

import { ArrowRight, Check, FilePlus2, Loader2, Paperclip, ShieldCheck, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  useAccount,
  useReadContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";

import { explorerTx, monadTestnet } from "@/lib/chain";
import {
  dateToServiceDay,
  isCompleteVin,
  normalizeVin,
  RECORD_TYPES,
  registry,
  type VehicleSummary,
} from "@/lib/registry";
import { cn, formatKm } from "@/lib/utils";

import { SectionHeading } from "./datasheet";
import { WalletButton } from "./wallet-button";

export function ReportForm() {
  const { address, isConnected, chainId } = useAccount();

  const [vin, setVin] = useState("");
  const [mileage, setMileage] = useState("");
  const [typeValue, setTypeValue] = useState<number>(0);
  const [note, setNote] = useState("");

  /**
   * The day the work was done, which is not always today: a garage may be
   * entering last week's job. Defaults to today and cannot be in the future.
   */
  const todayIso = new Date().toISOString().slice(0, 10);
  const [servicedOn, setServicedOn] = useState(todayIso);

  /**
   * Only used when opening a file for a vehicle the registry has never seen.
   * Empty means the token stays with the garage until the owner claims it,
   * which is what the contract does for the zero address.
   */
  const [vehicleOwner, setVehicleOwner] = useState("");

  /** IPFS attachment: the photo or invoice backing this record. */
  const [attachment, setAttachment] = useState<{ name: string; cid: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  /** Milliseconds between the signature landing and the receipt arriving. */
  const [confirmMs, setConfirmMs] = useState<number | null>(null);
  const sentAt = useRef<number | null>(null);

  const onRightNetwork = isConnected && chainId === monadTestnet.id;

  // Is this wallet allowed to write history at all?
  const { data: isService, isLoading: checkingService } = useReadContract({
    ...registry,
    functionName: "isServiceProvider",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address) && onRightNetwork },
  });

  // What the chain already knows about this VIN, refreshed as they type.
  const { data: summary, refetch: refetchSummary } = useReadContract({
    ...registry,
    functionName: "getVehicleSummaryByVin",
    args: [vin],
    query: { enabled: isCompleteVin(vin) && onRightNetwork },
  }) as { data: VehicleSummary | undefined; refetch: () => void };

  const { writeContract, data: hash, isPending, error: writeError, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  // Time the network, not the human: start the clock once the wallet has signed.
  useEffect(() => {
    if (hash && sentAt.current === null) sentAt.current = Date.now();
  }, [hash]);

  useEffect(() => {
    if (isSuccess && sentAt.current !== null) {
      setConfirmMs(Date.now() - sentAt.current);
      sentAt.current = null;
      refetchSummary();
    }
  }, [isSuccess, refetchSummary]);

  const mileageNumber = mileage === "" ? null : Number(mileage);
  const recordedKm = summary?.registered ? Number(summary.lastMileage) : null;

  /**
   * A VIN the chain has never seen is not an error - it is the other half of the
   * garage's job. The first shop to touch a car opens its file.
   */
  const registering = Boolean(summary) && summary?.registered === false;

  /**
   * The contract would reject a rollback anyway. Catching it here means the
   * garage sees why before paying for a signature, not after.
   */
  const rollback =
    recordedKm !== null && mileageNumber !== null && mileageNumber < recordedKm;

  const problem = useMemo(() => {
    if (!isCompleteVin(vin)) return "Şasi numarası 17 karakter olmalı.";
    if (mileageNumber === null || Number.isNaN(mileageNumber)) return "Kilometre girin.";
    if (mileageNumber <= 0) return "Kilometre sıfırdan büyük olmalı.";
    if (rollback) {
      return `Kayıtlı kilometre ${formatKm(recordedKm!)}. Daha düşük bir değer zincir tarafından reddedilir.`;
    }
    if (!servicedOn) return "İşlem tarihi girin.";
    if (servicedOn > todayIso) return "İşlem tarihi gelecekte olamaz.";
    if (registering && vehicleOwner.trim() && !/^0x[0-9a-fA-F]{40}$/.test(vehicleOwner.trim())) {
      return "Araç sahibi cüzdanı geçerli bir adres değil.";
    }
    return null;
  }, [
    vin,
    mileageNumber,
    rollback,
    recordedKm,
    servicedOn,
    todayIso,
    registering,
    vehicleOwner,
  ]);

  const canSubmit =
    onRightNetwork &&
    isService === true &&
    !problem &&
    !uploading &&
    !isPending &&
    !isConfirming;

  async function upload(file: File) {
    setUploading(true);
    setUploadError(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const response = await fetch("/api/upload", { method: "POST", body });
      const payload = (await response.json()) as { cid?: string; error?: string };

      if (!response.ok || !payload.cid) {
        throw new Error(payload.error ?? "Yükleme başarısız oldu.");
      }
      setAttachment({ name: file.name, cid: payload.cid });
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Yükleme başarısız oldu.");
    } finally {
      setUploading(false);
    }
  }

  function submit() {
    if (!canSubmit) return;
    setConfirmMs(null);
    sentAt.current = null;
    const day = dateToServiceDay(new Date(servicedOn));

    if (registering) {
      writeContract({
        ...registry,
        functionName: "registerVehicle",
        args: [
          normalizeVin(vin),
          mileageNumber!,
          day,
          // Zero address keeps the token at the garage until the owner claims it.
          (vehicleOwner.trim() || "0x0000000000000000000000000000000000000000") as `0x${string}`,
          attachment?.cid ?? "",
          note.trim() || "Sicile ilk kayıt",
        ],
      });
      return;
    }

    writeContract({
      ...registry,
      functionName: "addRecordByVin",
      args: [
        normalizeVin(vin),
        mileageNumber!,
        day,
        typeValue,
        attachment?.cid ?? "",
        note.trim(),
      ],
    });
  }

  function startOver() {
    reset();
    setConfirmMs(null);
    setMileage("");
    setNote("");
    setServicedOn(todayIso);
    setVehicleOwner("");
    setAttachment(null);
    setUploadError(null);
  }

  // --- states that replace the whole form -----------------------------------

  if (!isConnected || !onRightNetwork) {
    return (
      <Notice
        label="Adım 0"
        title="Cüzdanınızı bağlayın"
        body="Kayıt girebilmek için yetkili servis cüzdanınızla Monad Testnet'e bağlanın."
      >
        <WalletButton className="w-full sm:w-auto" />
      </Notice>
    );
  }

  if (checkingService) {
    return (
      <Notice
        label="Kontrol"
        title="Yetki sorgulanıyor"
        body="Cüzdanınızın sicile yazma yetkisi zincirden okunuyor."
        icon={<Loader2 className="size-5 animate-spin text-red" />}
      />
    );
  }

  if (isService !== true) {
    return (
      <Notice
        label="Reddedildi"
        tone="alert"
        title="Bu cüzdan yetkili değil"
        body="Sicile yalnızca onaylı servisler yazabilir. Adresinizi sicil yöneticisine iletip yetki isteyin."
      >
        <code className="numeric block break-all border-[1.5px] border-ink bg-paper-2 px-3 py-2 text-[13px] text-ink">
          {address}
        </code>
      </Notice>
    );
  }

  if (isSuccess) {
    return (
      <div>
        <div className="flex items-center gap-2.5">
          <span className="flex size-7 items-center justify-center bg-green text-white">
            <Check className="size-4" strokeWidth={3} />
          </span>
          <span className="label text-green">Onaylandı</span>
        </div>
        <h2 className="display mt-4 text-[clamp(30px,8vw,44px)]">
          {registering ? (
            <>
              Araç <em>sicile açıldı.</em>
            </>
          ) : (
            <>
              Zincire <em>yazıldı.</em>
            </>
          )}
        </h2>
        <p className="mt-3 text-[15px] text-ink-2">Kayıt artık silinemez ve değiştirilemez.</p>

        <div className="tbl-wrap mt-7">
          <table className="ds">
            <caption>
              <span className="cap-n">Tablo 1.</span> İşlem sonucu
            </caption>
            <tbody>
              <tr>
                <td>Durum</td>
                <td className="numeric font-semibold text-green">onaylandı</td>
              </tr>
              {confirmMs !== null && (
                <tr className="hl">
                  <td>Ağ onay süresi</td>
                  <td className="numeric font-semibold text-ink">{confirmMs} ms</td>
                </tr>
              )}
              <tr>
                <td>Şasi</td>
                <td className="numeric break-all text-ink">{normalizeVin(vin)}</td>
              </tr>
              {hash && (
                <tr>
                  <td>İşlem</td>
                  <td>
                    <a
                      href={explorerTx(hash)}
                      target="_blank"
                      rel="noreferrer"
                      className="numeric text-ink underline decoration-hair underline-offset-4 hover:decoration-red"
                    >
                      {hash.slice(0, 10)}…{hash.slice(-6)}
                    </a>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <button type="button" onClick={startOver} className="btn btn-ghost mt-7 w-full">
          Yeni kayıt gir
        </button>
      </div>
    );
  }

  // --- the form -------------------------------------------------------------

  return (
    <div className="space-y-10">
      {/* 1. The vehicle */}
      <section>
        <SectionHeading n={1}>Araç</SectionHeading>
        <Field label="Şasi numarası (VIN)" hint={`${vin.length}/17`}>
          <input
            value={vin}
            onChange={(e) => setVin(normalizeVin(e.target.value).slice(0, 17))}
            placeholder="WVWZZZ1JZXW000001"
            inputMode="text"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            className="numeric text-[17px] tracking-[0.05em]"
          />
        </Field>

        {summary?.registered && (
          <p className="mt-3 flex items-start gap-2 text-[14px] text-ink-2">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-green" strokeWidth={2} />
            <span>
              Sicilde kayıtlı — son kilometre{" "}
              <b className="numeric text-ink">{formatKm(summary.lastMileage)} km</b>,{" "}
              {Number(summary.recordCount)} kayıt
            </span>
          </p>
        )}

        {registering && (
          <div className="mt-3 border-l-[3px] border-red bg-red-wash px-4 py-3">
            <p className="flex items-center gap-2 text-[14px] font-bold text-ink">
              <FilePlus2 className="size-4 shrink-0 text-red" strokeWidth={2} />
              Bu araç sicilde yok — ilk kaydı siz açıyorsunuz
            </p>
            <p className="mt-1 text-[13px] leading-relaxed text-ink-2">
              Girdiğiniz kilometre aracın taban değeri olur; bundan sonra hiçbir servis
              bunun altına inemez.
            </p>
          </div>
        )}
      </section>

      {/* 2. The work */}
      <section>
        <SectionHeading n={2}>İşlem</SectionHeading>
        <div className="space-y-5">
          <Field label="Kilometre" hint="km" error={rollback}>
            <input
              value={mileage}
              onChange={(e) => setMileage(e.target.value.replace(/\D/g, "").slice(0, 7))}
              placeholder={recordedKm !== null ? formatKm(recordedKm) : "0"}
              inputMode="numeric"
              className={cn("numeric text-[17px]", rollback && "text-red")}
            />
          </Field>

          <Field label="İşlem tarihi">
            <input
              type="date"
              value={servicedOn}
              max={todayIso}
              onChange={(e) => setServicedOn(e.target.value)}
              className="numeric text-[15px]"
            />
          </Field>

          {registering ? (
            <Field label="Araç sahibi cüzdanı (isteğe bağlı)">
              <input
                value={vehicleOwner}
                onChange={(e) => setVehicleOwner(e.target.value.trim())}
                placeholder="0x… — boşsa araç serviste kalır"
                autoCorrect="off"
                spellCheck={false}
                className="numeric text-[14px]"
              />
            </Field>
          ) : (
            <fieldset>
              <legend className="label mb-2">İşlem tipi</legend>
              <div className="grid grid-cols-2 border-l-[1.5px] border-t-[1.5px] border-ink">
                {RECORD_TYPES.map((type) => {
                  const selected = typeValue === type.value;
                  return (
                    <button
                      key={type.value}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setTypeValue(type.value)}
                      className={cn(
                        "border-b-[1.5px] border-r-[1.5px] border-ink px-3 py-3 text-left text-[14px] transition",
                        selected
                          ? "bg-ink font-semibold text-white"
                          : "bg-white text-ink-2 hover:bg-paper-2",
                      )}
                    >
                      {type.label}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          )}

          <Field label="Not (isteğe bağlı)">
            <input
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, 120))}
              placeholder="Yağ ve filtre değişimi"
              className="text-[15px]"
            />
          </Field>
        </div>
      </section>

      {/* 3. The evidence */}
      <section>
        <SectionHeading n={3}>Belge</SectionHeading>
        {attachment ? (
          <div className="flex items-center gap-3 border-[1.5px] border-green px-4 py-3">
            <Paperclip className="size-4 shrink-0 text-green" strokeWidth={2} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-semibold text-ink">{attachment.name}</p>
              <p className="numeric truncate text-[12px] text-ink-3">{attachment.cid}</p>
            </div>
            <button
              type="button"
              onClick={() => setAttachment(null)}
              aria-label="Eki kaldır"
              className="p-1.5 text-ink-3 transition hover:bg-ink hover:text-white"
            >
              <X className="size-4" />
            </button>
          </div>
        ) : (
          <label
            className={cn(
              "flex cursor-pointer items-center gap-3 border-[1.5px] border-dashed border-ink px-4 py-3.5 text-[14px] text-ink-2 transition hover:bg-paper-2",
              uploading && "pointer-events-none opacity-60",
            )}
          >
            {uploading ? (
              <Loader2 className="size-4 shrink-0 animate-spin text-red" />
            ) : (
              <Paperclip className="size-4 shrink-0 text-red" strokeWidth={2} />
            )}
            {uploading ? "IPFS'e yükleniyor..." : "Fotoğraf veya fatura seç (isteğe bağlı)"}
            <input
              type="file"
              accept="image/*,application/pdf"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void upload(file);
                e.target.value = "";
              }}
            />
          </label>
        )}
        {uploadError && (
          <p className="mt-2 text-[13px] text-amber">
            {uploadError} Kaydı ek olmadan da gönderebilirsiniz.
          </p>
        )}
      </section>

      {/* Submit */}
      <div className="border-t-[1.5px] border-ink pt-6">
        {writeError && (
          <p className="mb-4 border-l-[3px] border-red bg-red-wash px-4 py-3 text-[14px] font-semibold text-red-ink">
            {writeError.message.includes("MileageRollback")
              ? "Zincir reddetti: kilometre geri alınamaz."
              : writeError.message.split("\n")[0]}
          </p>
        )}

        <button
          type="button"
          onClick={submit}
          disabled={!canSubmit}
          className="btn w-full py-[18px] text-[16px]"
        >
          {isPending ? (
            <>
              <Loader2 className="size-5 animate-spin" />
              Cüzdanda onaylayın
            </>
          ) : isConfirming ? (
            <>
              <Loader2 className="size-5 animate-spin" />
              Ağa gönderildi
            </>
          ) : (
            <>
              {registering ? "Aracı Sicile Kaydet" : "Monad Ağına Kaydet"}
              <ArrowRight className="size-5" strokeWidth={2} />
            </>
          )}
        </button>

        {problem && !isPending && !isConfirming && (
          <p
            className={cn(
              "mt-3 text-center text-[13px]",
              rollback ? "font-semibold text-red" : "text-ink-3",
            )}
          >
            {problem}
          </p>
        )}
      </div>
    </div>
  );
}

// --- small building blocks ---------------------------------------------------

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="label mb-2 block">{label}</span>
      <div className="field" data-error={error ? "true" : undefined}>
        {children}
        {hint && <span className="numeric shrink-0 text-[12px] text-ink-3">{hint}</span>}
      </div>
    </label>
  );
}

/** A state that replaces the form: not connected, checking, or refused. */
function Notice({
  label,
  title,
  body,
  icon,
  tone = "default",
  children,
}: {
  label: string;
  title: string;
  body: string;
  icon?: React.ReactNode;
  tone?: "default" | "alert";
  children?: React.ReactNode;
}) {
  return (
    <div className={cn("border-[1.5px] p-6", tone === "alert" ? "border-red" : "border-ink")}>
      <div className="flex items-center gap-2.5">
        {icon}
        <span className={cn("label", tone === "alert" && "text-red")}>{label}</span>
      </div>
      <h2 className="display mt-3 text-[clamp(28px,7vw,38px)]">{title}</h2>
      <p className="mt-3 text-[15px] text-ink-2">{body}</p>
      {children && <div className="mt-6">{children}</div>}
    </div>
  );
}
