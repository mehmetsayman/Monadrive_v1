import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { formatEther, keccak256, toHex, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";

import { network } from "hardhat";
import artifact from "../artifacts/contracts/VehicleRegistry.sol/VehicleRegistry.json" with { type: "json" };

/**
 * Where the money is.
 *
 * Two different things drain a testnet wallet and they are easy to confuse:
 * gas, which leaves for the network and never comes back, and report sales,
 * which land in the contract and wait to be withdrawn. This prints both.
 */

const HERE = dirname(fileURLToPath(import.meta.url));

const GARAGES = [
  { label: "ahmet", name: "Ahmet Usta Oto Servis" },
  { label: "yetkili", name: "Yetkili Servis Kadıköy" },
  { label: "ekspertiz", name: "TrustPoint Ekspertiz" },
] as const;

const garageKey = (label: string): Hex =>
  keccak256(toHex(`monaddrive/demo-garage/v1/${label}`));

const { viem, networkName } = await network.getOrCreate();
const publicClient = await viem.getPublicClient();

const deployment = JSON.parse(
  readFileSync(join(HERE, "..", "deployments", `${networkName}.json`), "utf8"),
) as { address: Hex; owner: Hex };

const registry = { address: deployment.address, abi: artifact.abi } as const;

const read = <T>(functionName: string, args?: unknown[]) =>
  publicClient.readContract({ ...registry, functionName, args }) as Promise<T>;

const mon = (wei: bigint) => `${formatEther(wei).padStart(12)} MON`;

// --- the contract -------------------------------------------------------------

const [vault, price, platformBps, providerCount] = await Promise.all([
  publicClient.getBalance({ address: deployment.address }),
  read<bigint>("reportPrice"),
  read<number>("platformShareBps"),
  read<bigint>("serviceProviderCount"),
]);

console.log(`\nSİCİL   ${deployment.address}`);
console.log(`  rapor fiyatı    ${formatEther(price)} MON`);
console.log(
  `  bölüşüm         %${Number(platformBps) / 100} platform / %${(10_000 - Number(platformBps)) / 100} servisler`,
);
console.log(`  onaylı servis   ${providerCount}`);
console.log(`  kasada bekleyen ${mon(vault)}   <- satılan raporlardan, çekilmeyi bekliyor`);

// --- who is owed what ---------------------------------------------------------

console.log("\nHESAPLAR");
console.log(
  "  rol          adres                                        cüzdan       çekilebilir gelir",
);

const rows: Array<{ role: string; address: Hex; earnings: bigint }> = [];

const ownerEarnings = await read<bigint>("earnings", [deployment.owner]);
rows.push({ role: "platform", address: deployment.owner, earnings: ownerEarnings });

// The MetaMask accounts `npm run roles` set up, when it has been run.
try {
  const roles = JSON.parse(
    readFileSync(join(HERE, "..", "deployments", `roles.${networkName}.json`), "utf8"),
  ) as { usta: Hex; musteri: Hex };

  rows.push({ role: "usta", address: roles.usta, earnings: await read<bigint>("earnings", [roles.usta]) });
  rows.push({
    role: "müşteri",
    address: roles.musteri,
    earnings: await read<bigint>("earnings", [roles.musteri]),
  });
} catch {
  // roles never set up on this network; the seeded garages below are the cast.
}

for (const garage of GARAGES) {
  const address = privateKeyToAccount(garageKey(garage.label)).address;
  rows.push({
    role: garage.label,
    address,
    earnings: await read<bigint>("earnings", [address]),
  });
}

let owedTotal = 0n;
for (const row of rows) {
  const balance = await publicClient.getBalance({ address: row.address });
  owedTotal += row.earnings;
  console.log(
    `  ${row.role.padEnd(12)} ${row.address}  ${formatEther(balance).slice(0, 10).padStart(10)}  ${formatEther(row.earnings).padStart(16)}`,
  );
}

// --- sales --------------------------------------------------------------------

/**
 * The public RPC caps how many blocks one eth_getLogs may cover, so this walks
 * backwards in small windows instead of asking for the contract's whole life.
 * It is a recent-sales view on purpose - the earnings table above is the
 * authoritative answer to "what am I owed".
 */
const WINDOW = 100n;
const LOOKBACK = 2_000n;

const head = await publicClient.getBlockNumber();
const floor = head > LOOKBACK ? head - LOOKBACK : 0n;

type Sale = { buyer: Hex; price: bigint };
const sales: Sale[] = [];
let scanned = 0n;

try {
  for (let to = head; to > floor; to -= WINDOW) {
    const from = to - WINDOW + 1n > floor ? to - WINDOW + 1n : floor;
    const logs = await publicClient.getContractEvents({
      ...registry,
      eventName: "ReportPurchased",
      fromBlock: from,
      toBlock: to,
    });
    for (const log of logs) {
      sales.push((log as unknown as { args: Sale }).args);
    }
    scanned += to - from + 1n;
  }
} catch {
  console.log("\n  (satış geçmişi okunamadı — RPC sınırı; gelir tablosu yine doğru)");
}

console.log(`\nSON SATIŞLAR   son ${scanned} blok içinde ${sales.length} rapor`);
if (sales.length === 0) {
  console.log("  Bu aralıkta satış yok. Kimsenin geliri yoksa henüz kimse rapor almamıştır.");
  console.log("  Bir satış üretmek için:  npm run buy");
} else {
  for (const sale of sales.slice(0, 5)) {
    console.log(`  ${sale.buyer}  ${formatEther(sale.price)} MON`);
  }
}

console.log(`\n  dağıtılan toplam ${mon(owedTotal)}`);
if (owedTotal !== vault) {
  console.log(`  (kasa ${mon(vault)} — aradaki fark çekilmiş olanlar)`);
}

console.log(
  "\nNot: gas ücretleri bu tablonun dışında. Onlar Monad ağına gider ve geri gelmez;",
);
console.log("kontratın kasasına yalnızca rapor satışları girer.\n");
