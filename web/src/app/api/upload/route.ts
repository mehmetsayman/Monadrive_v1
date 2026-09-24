import { NextResponse } from "next/server";

/**
 * Pins a photo or invoice to IPFS and hands the CID back to the client, which
 * then writes it into the record.
 *
 * The Pinata JWT stays on the server. Shipping it to the browser would put a
 * write credential in every visitor's devtools.
 */

const PINATA_ENDPOINT = "https://api.pinata.cloud/pinning/pinFileToIPFS";
const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/heic", "application/pdf"];

export async function POST(request: Request) {
  const jwt = process.env.PINATA_JWT;

  if (!jwt) {
    return NextResponse.json(
      {
        error: "IPFS yükleme yapılandırılmamış.",
        detail: "PINATA_JWT ortam değişkeni tanımlı değil.",
      },
      { status: 501 },
    );
  }

  let file: File | null = null;
  try {
    const form = await request.formData();
    const value = form.get("file");
    if (value instanceof File) file = value;
  } catch {
    return NextResponse.json({ error: "Geçersiz istek gövdesi." }, { status: 400 });
  }

  if (!file) {
    return NextResponse.json({ error: "Dosya bulunamadı." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Dosya 10 MB sınırını aşıyor." }, { status: 413 });
  }
  if (file.type && !ALLOWED.includes(file.type)) {
    return NextResponse.json(
      { error: "Yalnızca fotoğraf ve PDF yüklenebilir." },
      { status: 415 },
    );
  }

  const outbound = new FormData();
  outbound.append("file", file, file.name || "kayit");
  outbound.append(
    "pinataMetadata",
    JSON.stringify({ name: `monaddrive/${Date.now()}-${file.name || "kayit"}` }),
  );

  const response = await fetch(PINATA_ENDPOINT, {
    method: "POST",
    headers: { Authorization: `Bearer ${jwt}` },
    body: outbound,
  });

  if (!response.ok) {
    // Pinata's message can name the account; keep it server-side.
    console.error("pinata upload failed", response.status, await response.text());
    return NextResponse.json(
      { error: "IPFS yükleme başarısız oldu." },
      { status: 502 },
    );
  }

  const { IpfsHash } = (await response.json()) as { IpfsHash: string };

  return NextResponse.json({ cid: IpfsHash });
}
