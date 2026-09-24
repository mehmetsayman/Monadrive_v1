import "server-only";

import { createPublicClient, http } from "viem";

import { monadTestnet } from "./chain";
import {
  normalizeVin,
  registry,
  vinToTokenId,
  type VehicleRecord,
  type VehicleSummary,
} from "./registry";

/**
 * The buyer panel reads the chain on the server. A used-car buyer standing in a
 * lot has no wallet and no reason to install one - asking them to connect before
 * they can see a history would defeat the point of a public registry.
 */
export const publicClient = createPublicClient({
  chain: monadTestnet,
  // The public RPC allows 15 requests a second, and a vehicle page makes a read
  // per garage on top of the summary, records and token image. Multicall folds
  // each Promise.all below into a single eth_call; the retry covers the rest.
  batch: { multicall: { wait: 16 } },
  transport: http(undefined, { retryCount: 3, retryDelay: 250 }),
});

export type Garage = {
  address: `0x${string}`;
  name: string;
  recordCount: number;
  active: boolean;
};

export type VehicleDossier = {
  vin: string;
  tokenId: bigint;
  summary: VehicleSummary;
  records: VehicleRecord[];
  garages: Map<string, Garage>;
  image: string | null;
};

/** Everything the vehicle page renders, or null when the VIN is unknown. */
export async function loadVehicle(rawVin: string): Promise<VehicleDossier | null> {
  const vin = normalizeVin(rawVin);
  if (vin.length !== 17) return null;

  const tokenId = vinToTokenId(vin);

  const [summary, records] = await Promise.all([
    publicClient.readContract({
      ...registry,
      functionName: "getVehicleSummary",
      args: [tokenId],
    }) as Promise<VehicleSummary>,
    publicClient.readContract({
      ...registry,
      functionName: "getRecords",
      args: [tokenId],
    }) as Promise<readonly VehicleRecord[]>,
  ]);

  if (!summary.registered) return null;

  const reporters = [...new Set(records.map((record) => record.reporter))];

  const [garageList, image] = await Promise.all([
    Promise.all(
      reporters.map(async (address) => {
        const provider = (await publicClient.readContract({
          ...registry,
          functionName: "getServiceProvider",
          args: [address],
        })) as { name: string; recordCount: number; active: boolean };

        return {
          address,
          name: provider.name || "Bilinmeyen servis",
          recordCount: Number(provider.recordCount),
          active: provider.active,
        } satisfies Garage;
      }),
    ),
    loadTokenImage(tokenId),
  ]);

  return {
    vin,
    tokenId,
    summary,
    // Newest first: a buyer reads the recent past before the distant one.
    records: [...records].reverse(),
    garages: new Map(garageList.map((garage) => [garage.address.toLowerCase(), garage])),
    image,
  };
}

/**
 * Pulls the SVG out of the on-chain metadata. Rendering the real token image is
 * the difference between claiming the NFT is dynamic and showing it.
 */
async function loadTokenImage(tokenId: bigint): Promise<string | null> {
  try {
    const uri = (await publicClient.readContract({
      ...registry,
      functionName: "tokenURI",
      args: [tokenId],
    })) as string;

    const encoded = uri.split(",")[1];
    if (!encoded) return null;

    const metadata = JSON.parse(Buffer.from(encoded, "base64").toString("utf8")) as {
      image?: string;
    };
    return metadata.image ?? null;
  } catch {
    return null;
  }
}
