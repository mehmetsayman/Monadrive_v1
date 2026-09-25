import "server-only";

import { createPublicClient, http } from "viem";

import { monadTestnet } from "./chain";
import {
  normalizeVin,
  registry,
  vinToTokenId,
  type VehicleSummary,
} from "./registry";

/**
 * The buyer panel reads the chain on the server. A used-car buyer standing in a
 * lot has no wallet and no reason to install one - asking them to connect before
 * they can see a history would defeat the point of a public registry.
 */
const publicClient = createPublicClient({
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

/**
 * The free preview. Everything here is what the paywall lets anyone see, so it is
 * safe to render on the server and ship to the browser.
 *
 * The gated half - dates, notes, which garage wrote what, attachments - is
 * deliberately NOT loaded here. Fetching it server-side and hiding it with CSS
 * would put the whole report in the page source.
 */
export type VehiclePreview = {
  vin: string;
  tokenId: bigint;
  summary: VehicleSummary;
  /** Report price in wei, as a string so it survives the server boundary. */
  priceWei: string;
  /** How many garages would share this sale. A count, never the addresses -
   *  who worked on the car is part of what the report sells. */
  garageCount: number;
  /** The garages' combined share, in basis points. */
  garageShareBps: number;
};

export async function loadVehiclePreview(rawVin: string): Promise<VehiclePreview | null> {
  const vin = normalizeVin(rawVin);
  if (vin.length !== 17) return null;

  const tokenId = vinToTokenId(vin);

  const summary = (await publicClient.readContract({
    ...registry,
    functionName: "getVehicleSummary",
    args: [tokenId],
  })) as VehicleSummary;

  if (!summary.registered) return null;

  const [price, platformShareBps, split] = await Promise.all([
    publicClient.readContract({ ...registry, functionName: "reportPrice" }) as Promise<bigint>,
    publicClient.readContract({ ...registry, functionName: "platformShareBps" }) as Promise<number>,
    publicClient.readContract({
      ...registry,
      functionName: "reportSplit",
      args: [tokenId],
    }) as Promise<readonly [readonly string[], readonly bigint[]]>,
  ]);

  return {
    vin,
    tokenId,
    summary,
    priceWei: price.toString(),
    // The split always ends with the platform, so the rest are garages.
    garageCount: Math.max(split[0].length - 1, 0),
    garageShareBps: 10_000 - Number(platformShareBps),
  };
}

/** The registry's current terms, for the tables that quote them. */
export async function loadRegistryInfo() {
  const [price, platformShareBps] = await Promise.all([
    publicClient.readContract({ ...registry, functionName: "reportPrice" }) as Promise<bigint>,
    publicClient.readContract({ ...registry, functionName: "platformShareBps" }) as Promise<number>,
  ]);

  return {
    priceWei: price.toString(),
    platformShareBps: Number(platformShareBps),
  };
}
