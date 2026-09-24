"use client";

import {
  ArrowRight,
  Check,
  Loader2,
  Paperclip,
  ShieldAlert,
  ShieldCheck,
  X,
} from "lucide-react";
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
   * The contract would reject a rollback anyway. Catching it here means the
   * garage sees why before paying for a signature, not after.
   */
  const rollback =
    recordedKm !== null && mileageNumber !== null && mileageNumber < recordedKm;

  const problem = useMemo(() => {
    if (!isCompleteVin(vin)) return "Şasi numarası 17 karakter olmalı.";
    if (summary && !summary.registered) return "Bu şasi numarası sicile kayıtlı değil.";
    if (mileageNumber === null || Number.isNaN(mileageNumber)) return "Kilometre girin.";
    if (mileageNumber <= 0) return "Kilometre sıfırdan büyük olmalı.";
    if (rollback) {
      return `Kayıtlı kilometre ${formatKm(recordedKm!)}. Daha düşük bir değer zincir tarafından reddedilir.`;
    }
    if (!servicedOn) return "İşlem tarihi girin.";
    if (servicedOn > todayIso) return "İşlem tarihi gelecekte olamaz.";
    return null;
  }, [vin, summary, mileageNumber, rollback, recordedKm, servicedOn, todayIso]);

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
    writeContract({
      ...registry,
      functionName: "addRecordByVin",
      args: [
        normalizeVin(vin),
        mileageNumber!,
        dateToServiceDay(new Date(servicedOn)),
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
    setAttachment(null);
    setUploadError(null);
  }

  // --- states that replace the whole form -----------------------------------

  if (!isConnected || !onRightNetwork) {
    return (
      <Centered
        icon={<ShieldAlert className="size-7 text-violet-bright" />}
        title="Cüzdanınızı bağlayın"
        body="Kayıt girebilmek için yetkili servis cüzdanınızla Monad Testnet'e bağlanmanız gerekiyor."
      >
        <WalletButton />
      </Centered>
    );
  }

  if (checkingService) {
    return (
      <Centered
        icon={<Loader2 className="size-7 animate-spin text-violet-bright" />}
        title="Yetki kontrol ediliyor"
        body="Cüzdanınızın sicile yazma yetkisi sorgulanıyor."
      />
    );
  }

  if (isService !== true) {
    return (
      <Centered
        icon={<X className="size-7 text-danger" />}
        title="Bu cüzdan yetkili değil"
        body="Sicile yalnızca onaylı servisler yazabilir. Cüzdan adresinizi sicil yöneticisine ileterek yetki talep edin."
      >
        <code className="numeric rounded-lg border border-violet/25 bg-ink/60 px-3 py-2 text-xs text-muted">
          {address}
        </code>
      </Centered>
    );
  }

  if (isSuccess) {
    return (
      <Centered
        icon={<Check className="size-7 text-neon" />}
        title="Zincire yazıldı"
        body="Kayıt artık silinemez ve değiştirilemez."
      >
        {confirmMs !== null && (
          <div className="glass glass-lit px-6 py-4 text-center">
            <p className="label">Ağ onay süresi</p>
            <p className="numeric mt-1 text-4xl font-semibold text-neon">
              {confirmMs}
              <span className="ml-1 text-lg text-muted">ms</span>
            </p>
          </div>
        )}
        <div className="flex flex-col items-center gap-3">
          {hash && (
            <a
              href={explorerTx(hash)}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-violet-bright underline-offset-4 hover:underline"
            >
              İşlemi explorer&apos;da gör
            </a>
          )}
          <button
            type="button"
            onClick={startOver}
            className="rounded-full border border-violet/40 bg-violet/15 px-6 py-2.5 text-sm font-medium transition hover:bg-violet/25"
          >
            Yeni kayıt gir
          </button>
        </div>
      </Centered>
    );
  }

  // --- the form -------------------------------------------------------------

  return (
    <div className="space-y-5">
      <Field label="Şasi numarası (VIN)">
        <input
          value={vin}
          onChange={(e) => setVin(normalizeVin(e.target.value).slice(0, 17))}
          placeholder="WVWZZZ1JZXW000001"
          inputMode="text"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          className="numeric w-full bg-transparent text-lg tracking-[0.08em] text-bright outline-none placeholder:text-faint/60"
        />
        <span className="numeric shrink-0 text-xs text-faint">{vin.length}/17</span>
      </Field>

      {summary?.registered && (
        <div className="flex items-center gap-2 px-1 text-sm text-muted">
          <ShieldCheck className="size-4 shrink-0 text-neon" />
          <span>
            Sicilde kayıtlı — son kilometre{" "}
            <span className="numeric text-bright">{formatKm(summary.lastMileage)} km</span>,{" "}
            {Number(summary.recordCount)} kayıt
          </span>
        </div>
      )}

      <Field label="Kilometre" error={rollback}>
        <input
          value={mileage}
          onChange={(e) => setMileage(e.target.value.replace(/\D/g, "").slice(0, 7))}
          placeholder={recordedKm !== null ? formatKm(recordedKm) : "0"}
          inputMode="numeric"
          className={cn(
            "numeric w-full bg-transparent text-lg outline-none placeholder:text-faint/60",
            rollback ? "text-danger" : "text-bright",
          )}
        />
        <span className="shrink-0 text-sm text-faint">km</span>
      </Field>

      <Field label="İşlem tarihi">
        <input
          type="date"
          value={servicedOn}
          max={todayIso}
          onChange={(e) => setServicedOn(e.target.value)}
          className="numeric w-full bg-transparent text-base text-bright outline-none [color-scheme:dark]"
        />
      </Field>

      <div>
        <p className="label mb-2.5 px-1">İşlem tipi</p>
        <div className="grid grid-cols-2 gap-2">
          {RECORD_TYPES.map((type) => (
            <button
              key={type.value}
              type="button"
              onClick={() => setTypeValue(type.value)}
              className={cn(
                "rounded-xl border px-3 py-3 text-left text-sm transition",
                typeValue === type.value
                  ? "border-violet bg-violet/20 text-bright"
                  : "border-violet/20 bg-ink/40 text-muted hover:border-violet/40",
              )}
            >
              {type.label}
            </button>
          ))}
        </div>
      </div>

      <Field label="Not (isteğe bağlı)">
        <input
          value={note}
          onChange={(e) => setNote(e.target.value.slice(0, 120))}
          placeholder="Yağ ve filtre değişimi"
          className="w-full bg-transparent text-base text-bright outline-none placeholder:text-faint/60"
        />
      </Field>

      <div>
        <p className="label mb-2.5 px-1">Fotoğraf veya fatura (isteğe bağlı)</p>
        {attachment ? (
          <div className="flex items-center gap-3 rounded-2xl border border-neon/30 bg-neon/5 px-4 py-3.5">
            <Paperclip className="size-4 shrink-0 text-neon" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-bright">{attachment.name}</p>
              <p className="numeric truncate text-xs text-faint">{attachment.cid}</p>
            </div>
            <button
              type="button"
              onClick={() => setAttachment(null)}
              aria-label="Eki kaldır"
              className="rounded-full p-1.5 text-faint transition hover:bg-violet/15 hover:text-bright"
            >
              <X className="size-4" />
            </button>
          </div>
        ) : (
          <label
            className={cn(
              "flex cursor-pointer items-center gap-3 rounded-2xl border border-dashed border-violet/30",
              "bg-ink/40 px-4 py-3.5 text-sm text-muted transition hover:border-violet/60",
              uploading && "pointer-events-none opacity-60",
            )}
          >
            {uploading ? (
              <Loader2 className="size-4 shrink-0 animate-spin text-violet-bright" />
            ) : (
              <Paperclip className="size-4 shrink-0 text-violet-bright" />
            )}
            {uploading ? "IPFS'e yükleniyor..." : "Dosya seç"}
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
          <p className="mt-2 px-1 text-xs text-amber">
            {uploadError} Kaydı ek olmadan da gönderebilirsiniz.
          </p>
        )}
      </div>

      {writeError && (
        <p className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          {writeError.message.includes("MileageRollback")
            ? "Zincir reddetti: kilometre geri alınamaz."
            : writeError.message.split("\n")[0]}
        </p>
      )}

      <button
        type="button"
        onClick={submit}
        disabled={!canSubmit}
        className={cn(
          "flex w-full items-center justify-center gap-2.5 rounded-2xl px-6 py-5",
          "text-base font-semibold transition",
          canSubmit
            ? "bg-violet text-white shadow-[0_12px_40px_-12px_var(--color-violet)] hover:bg-violet-bright active:scale-[0.99]"
            : "cursor-not-allowed bg-slate text-faint",
        )}
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
            Monad Ağına Kaydet
            <ArrowRight className="size-5" />
          </>
        )}
      </button>

      {problem && !isPending && !isConfirming && (
        <p className="px-1 text-center text-sm text-faint">{problem}</p>
      )}
    </div>
  );
}

// --- small building blocks ---------------------------------------------------

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="label mb-2 block px-1">{label}</span>
      <div
        className={cn(
          "flex items-center gap-3 rounded-2xl border bg-ink/50 px-4 py-4 transition",
          "focus-within:border-violet focus-within:bg-ink/80",
          error ? "border-danger/60" : "border-violet/20",
        )}
      >
        {children}
      </div>
    </label>
  );
}

function Centered({
  icon,
  title,
  body,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-5 py-10 text-center">
      <div className="glass flex size-16 items-center justify-center rounded-2xl">{icon}</div>
      <div className="space-y-2">
        <h2 className="text-xl font-semibold text-bright">{title}</h2>
        <p className="mx-auto max-w-sm text-sm leading-relaxed text-muted">{body}</p>
      </div>
      {children}
    </div>
  );
}
