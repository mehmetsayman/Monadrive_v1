import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  createWalletClient,
  formatEther,
  getContract,
  http,
  keccak256,
  parseEther,
  toHex,
  type Hex,
  type WalletClient,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

import { network } from "hardhat";
import artifact from "../artifacts/contracts/VehicleRegistry.sol/VehicleRegistry.json" with { type: "json" };

const HERE = dirname(fileURLToPath(import.meta.url));

const RecordType = {
  Maintenance: 0,
  Repair: 1,
  PartReplacement: 2,
  Inspection: 3,
  Accident: 4,
  HeavyDamage: 5,
} as const;

/**
 * Throwaway demo identities, derived from a fixed label so every run of the seed
 * reaches the same addresses. Testnet only - never put value behind these.
 */
const garageKey = (label: string): Hex =>
  keccak256(toHex(`monaddrive/demo-garage/v1/${label}`));

const GARAGES = [
  { label: "ahmet", name: "Ahmet Usta Oto Servis" },
  { label: "yetkili", name: "Yetkili Servis Kadikoy" },
  { label: "ekspertiz", name: "TrustPoint Ekspertiz" },
] as const;

/**
 * Monad testnet runs a base fee around 100 gwei, and viem reserves
 * `maxFeePerGas * gasLimit` up front - roughly 0.05 MON for a single register call
 * even though the transaction actually costs a fraction of that. So each garage
 * needs headroom for several writes, not just their real cost.
 */
const GARAGE_TARGET_BALANCE = parseEther("0.4");
const GARAGE_MIN_BALANCE = parseEther("0.15");

type Step = {
  by: number;
  mileage: number;
  type: (typeof RecordType)[keyof typeof RecordType];
  note: string;
};

const VEHICLES: Array<{
  vin: string;
  label: string;
  genesis: Step;
  history: Step[];
}> = [
  {
    vin: "WVWZZZ1JZXW000001",
    label: "Bakimli, kazasiz",
    genesis: {
      by: 2,
      mileage: 12_000,
      type: RecordType.Inspection,
      note: "Sicile ilk kayit - ekspertiz temiz",
    },
    history: [
      { by: 0, mileage: 25_400, type: RecordType.Maintenance, note: "Periyodik bakim, yag ve filtre" },
      { by: 1, mileage: 41_800, type: RecordType.Maintenance, note: "40.000 km bakimi" },
      { by: 2, mileage: 56_200, type: RecordType.Inspection, note: "Yillik muayene - gecti" },
      { by: 0, mileage: 72_900, type: RecordType.PartReplacement, note: "On fren balatasi" },
      { by: 0, mileage: 88_100, type: RecordType.Maintenance, note: "Periyodik bakim" },
    ],
  },
  {
    vin: "NM0GE9F79E1234567",
    label: "Hafif kazali",
    genesis: {
      by: 2,
      mileage: 30_000,
      type: RecordType.Inspection,
      note: "Sicile ilk kayit",
    },
    history: [
      { by: 0, mileage: 61_500, type: RecordType.Maintenance, note: "Periyodik bakim" },
      { by: 1, mileage: 88_300, type: RecordType.Accident, note: "Arka tampon carpma - hafif" },
      { by: 1, mileage: 89_000, type: RecordType.Repair, note: "Arka tampon degisimi ve boya" },
      { by: 0, mileage: 118_700, type: RecordType.Maintenance, note: "Periyodik bakim" },
      { by: 2, mileage: 131_200, type: RecordType.Inspection, note: "Yillik muayene - gecti" },
    ],
  },
  {
    vin: "1HGBH41JXMN109186",
    label: "Agir hasar kayitli",
    genesis: {
      by: 2,
      mileage: 50_000,
      type: RecordType.Inspection,
      note: "Sicile ilk kayit",
    },
    history: [
      { by: 1, mileage: 71_400, type: RecordType.Accident, note: "Yan carpma - kapi ve marspiyel" },
      { by: 1, mileage: 96_800, type: RecordType.HeavyDamage, note: "On sasi deformasyonu tespit edildi" },
      { by: 1, mileage: 99_200, type: RecordType.Repair, note: "Sasi duzeltme ve kaynak" },
      { by: 0, mileage: 142_500, type: RecordType.Maintenance, note: "Periyodik bakim" },
    ],
  },
];

// -----------------------------------------------------------------------------

const { viem, networkName } = await network.getOrCreate();

const publicClient = await viem.getPublicClient();
const [deployer] = await viem.getWalletClients();
const chain = publicClient.chain;
const rpcUrl = (chain?.rpcUrls?.default?.http?.[0] as string) ?? undefined;

const deployment = JSON.parse(
  readFileSync(join(HERE, "..", "deployments", `${networkName}.json`), "utf8"),
) as { address: Hex; chainId: number };

console.log(`network    ${networkName} (chainId ${deployment.chainId})`);
console.log(`registry   ${deployment.address}`);
console.log(`deployer   ${deployer.account.address}\n`);

const abi = artifact.abi;
const timings: number[] = [];

/** Sends a write, waits for it to land, and records how long that took. */
async function send(label: string, submit: () => Promise<Hex>) {
  const startedAt = Date.now();
  const hash = await submit();
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  const elapsed = Date.now() - startedAt;
  timings.push(elapsed);

  const status = receipt.status === "success" ? "ok " : "FAIL";
  console.log(`  ${status} ${elapsed.toString().padStart(5)} ms  ${label}`);
  return receipt;
}

function registryFor(wallet: WalletClient) {
  return getContract({
    address: deployment.address,
    abi,
    client: { public: publicClient, wallet },
  });
}

const asOwner = registryFor(deployer);

// --- 1. Bring the demo garages online -----------------------------------------

console.log("approving garages");

const garageWallets: WalletClient[] = [];

for (const garage of GARAGES) {
  const account = privateKeyToAccount(garageKey(garage.label));
  const wallet = createWalletClient({ account, chain, transport: http(rpcUrl) });
  garageWallets.push(wallet);

  const balance = await publicClient.getBalance({ address: account.address });
  if (balance < GARAGE_MIN_BALANCE) {
    const topUp = GARAGE_TARGET_BALANCE - balance;
    await send(`fund ${garage.name} (+${formatEther(topUp)} MON)`, () =>
      deployer.sendTransaction({ to: account.address, value: topUp }),
    );
  }

  const alreadyActive = (await asOwner.read.isServiceProvider([account.address])) as boolean;
  if (alreadyActive) {
    console.log(`  --       0 ms  ${garage.name} already approved`);
  } else {
    await send(`approve ${garage.name}`, () =>
      asOwner.write.setServiceProvider([account.address, garage.name, true]),
    );
  }

  console.log(`           ${account.address}  ${garage.name}`);
}

// --- 2. Write the demo histories ----------------------------------------------

for (const vehicle of VEHICLES) {
  const tokenId = (await asOwner.read.vinToTokenId([vehicle.vin])) as bigint;
  const registered = (await asOwner.read.isRegistered([tokenId])) as boolean;

  console.log(`\n${vehicle.vin}  (${vehicle.label})`);

  if (registered) {
    console.log("  -- already on the registry, skipping");
    continue;
  }

  const genesisGarage = registryFor(garageWallets[vehicle.genesis.by]);
  await send(`register @ ${vehicle.genesis.mileage.toLocaleString("tr-TR")} km`, () =>
    genesisGarage.write.registerVehicle([
      vehicle.vin,
      vehicle.genesis.mileage,
      deployer.account.address,
      "",
      vehicle.genesis.note,
    ]),
  );

  for (const step of vehicle.history) {
    const garage = registryFor(garageWallets[step.by]);
    await send(`${step.mileage.toLocaleString("tr-TR")} km  ${step.note}`, () =>
      garage.write.addRecordByVin([vehicle.vin, step.mileage, step.type, "", step.note]),
    );
  }

  const summary = (await asOwner.read.getVehicleSummary([tokenId])) as {
    lastMileage: number;
    healthScore: number;
    recordCount: number;
    accidentCount: number;
  };

  console.log(
    `  => ${summary.recordCount} records, ${summary.lastMileage.toLocaleString("tr-TR")} km, ` +
      `score ${summary.healthScore}/100, ${summary.accidentCount} accidents`,
  );
}

// --- 3. What the pitch gets to quote ------------------------------------------

if (timings.length > 0) {
  const sorted = [...timings].sort((a, b) => a - b);
  const avg = Math.round(timings.reduce((a, b) => a + b, 0) / timings.length);
  const median = sorted[Math.floor(sorted.length / 2)];

  console.log(
    `\n${timings.length} transactions  |  fastest ${sorted[0]} ms  ` +
      `|  median ${median} ms  |  average ${avg} ms  |  slowest ${sorted.at(-1)} ms`,
  );
}
