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
import { sendResilient, waitForBalance, warmUp } from "./rpc.js";

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
  { label: "yetkili", name: "Yetkili Servis Kadıköy" },
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
  /** ISO date of the day the work was actually done. */
  on: string;
  mileage: number;
  type: (typeof RecordType)[keyof typeof RecordType];
  note: string;
};

/** The units the contract stores service dates in: whole days since the epoch. */
function toServiceDay(iso: string): number {
  const day = Math.floor(Date.parse(`${iso}T12:00:00Z`) / 86_400_000);
  if (!Number.isFinite(day)) throw new Error(`bad date in the seed data: ${iso}`);
  return day;
}

const VEHICLES: Array<{
  vin: string;
  label: string;
  genesis: Step;
  history: Step[];
}> = [
  {
    vin: "WVWZZZ1JZXW000001",
    label: "Bakımlı, kazasız",
    genesis: {
      by: 2,
      on: "2019-03-14",
      mileage: 12_000,
      type: RecordType.Inspection,
      note: "Sicile ilk kayıt — ekspertiz temiz çıktı",
    },
    history: [
      { by: 0, on: "2019-11-02", mileage: 25_400, type: RecordType.Maintenance, note: "Yağ, yağ filtresi ve polen filtresi değişimi" },
      { by: 1, on: "2020-08-21", mileage: 41_800, type: RecordType.Maintenance, note: "40.000 km periyodik bakımı" },
      { by: 2, on: "2021-06-09", mileage: 56_200, type: RecordType.Inspection, note: "Yıllık muayene — ağır kusur yok" },
      { by: 0, on: "2022-10-17", mileage: 72_900, type: RecordType.PartReplacement, note: "Ön fren balatası ve disk değişimi" },
      { by: 0, on: "2024-04-25", mileage: 88_100, type: RecordType.Maintenance, note: "Yağ değişimi ve genel kontrol" },
    ],
  },
  {
    vin: "NM0GE9F79E1234567",
    label: "Hafif kazalı",
    genesis: {
      by: 2,
      on: "2018-05-30",
      mileage: 30_000,
      type: RecordType.Inspection,
      note: "Sicile ilk kayıt",
    },
    history: [
      { by: 0, on: "2019-09-12", mileage: 61_500, type: RecordType.Maintenance, note: "Yağ ve filtre değişimi" },
      { by: 1, on: "2021-02-08", mileage: 88_300, type: RecordType.Accident, note: "Arka tamponda çarpma — hafif hasar" },
      { by: 1, on: "2021-02-19", mileage: 89_000, type: RecordType.Repair, note: "Arka tampon değişimi ve boya" },
      { by: 0, on: "2023-07-04", mileage: 118_700, type: RecordType.Maintenance, note: "Triger seti ve devirdaim değişimi" },
      { by: 2, on: "2025-05-16", mileage: 131_200, type: RecordType.Inspection, note: "Yıllık muayene — ağır kusur yok" },
    ],
  },
  {
    // Deliberately almost empty. A garage's first record on this car makes it
    // half the history, so a sale afterwards pays a share worth pointing at.
    vin: "TMBJJ7NE0J0123456",
    label: "Sicile yeni girmiş",
    genesis: {
      by: 2,
      on: "2023-06-15",
      mileage: 18_000,
      type: RecordType.Inspection,
      note: "Sicile ilk kayıt — ekspertiz temiz çıktı",
    },
    history: [],
  },
  {
    vin: "1HGBH41JXMN109186",
    label: "Ağır hasar kayıtlı",
    genesis: {
      by: 2,
      on: "2017-09-22",
      mileage: 50_000,
      type: RecordType.Inspection,
      note: "Sicile ilk kayıt",
    },
    history: [
      { by: 1, on: "2019-01-27", mileage: 71_400, type: RecordType.Accident, note: "Yan çarpma — sol ön kapı ve marşpiyel" },
      { by: 1, on: "2020-11-30", mileage: 96_800, type: RecordType.HeavyDamage, note: "Ön şasi deformasyonu tespit edildi" },
      { by: 1, on: "2020-12-15", mileage: 99_200, type: RecordType.Repair, note: "Şasi düzeltme ve kaynak işlemi" },
      { by: 0, on: "2024-08-09", mileage: 142_500, type: RecordType.Maintenance, note: "Yağ değişimi ve fren kontrolü" },
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
async function send(
  label: string,
  submit: (overrides: { maxPriorityFeePerGas?: bigint }) => Promise<Hex>,
) {
  const startedAt = Date.now();
  const hash = await sendResilient(submit);
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
    await send(`fund ${garage.name} (+${formatEther(topUp)} MON)`, (overrides) =>
      deployer.sendTransaction({ to: account.address, value: topUp, ...overrides }),
    );

    // The receipt is not enough; wait until the RPC agrees the money is there.
    await waitForBalance(publicClient, account.address, GARAGE_MIN_BALANCE);
  }

  // A never-used account's first contract call is refused. See scripts/rpc.ts.
  if (await warmUp(publicClient, wallet)) {
    console.log(`  --       -- ms  ${garage.name} hesabı ısıtıldı`);
  }

  const alreadyActive = (await asOwner.read.isServiceProvider([account.address])) as boolean;
  if (alreadyActive) {
    console.log(`  --       0 ms  ${garage.name} already approved`);
  } else {
    await send(`approve ${garage.name}`, (overrides) =>
      asOwner.write.setServiceProvider([account.address, garage.name, true], overrides),
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
  await send(`register @ ${vehicle.genesis.mileage.toLocaleString("tr-TR")} km  (${vehicle.genesis.on})`, (overrides) =>
    genesisGarage.write.registerVehicle([
      vehicle.vin,
      vehicle.genesis.mileage,
      toServiceDay(vehicle.genesis.on),
      deployer.account.address,
      "",
      vehicle.genesis.note,
    ], overrides),
  );

  for (const step of vehicle.history) {
    const garage = registryFor(garageWallets[step.by]);
    await send(`${step.on}  ${step.mileage.toLocaleString("tr-TR")} km  ${step.note}`, (overrides) =>
      garage.write.addRecordByVin([
        vehicle.vin,
        step.mileage,
        toServiceDay(step.on),
        step.type,
        "",
        step.note,
      ]),
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
