import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  createWalletClient,
  getContract,
  http,
  keccak256,
  toHex,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

import { network } from "hardhat";
import artifact from "../artifacts/contracts/VehicleRegistry.sol/VehicleRegistry.json" with { type: "json" };
import { sendResilient } from "./rpc.js";

/**
 * Registers a fresh vehicle with nothing but its first inspection.
 *
 * Report access is permanent per vehicle, which is right for a buyer and
 * inconvenient for a demo: once your customer wallet has opened a car, that car
 * can never show the paywall again. So each recording gets a new car.
 *
 * A near-empty history is also what makes a garage's cut worth looking at. Write
 * one record on this car and the garage owns half of it.
 *
 *   npm run newcar
 *   VIN=TMBJJ7NE0J0999999 KM=42000 npm run newcar
 */

const HERE = dirname(fileURLToPath(import.meta.url));

/** VIN alphabet: no I, O or Q, because they read as 1 and 0. */
const ALPHABET = "ABCDEFGHJKLMNPRSTUVWXYZ0123456789";

function generateVin(): string {
  const seed = keccak256(toHex(`monaddrive/newcar/${Date.now()}/${Math.random()}`));
  let vin = "MD";
  for (let i = 0; i < 15; i++) {
    vin += ALPHABET[parseInt(seed.slice(2 + i * 2, 4 + i * 2), 16) % ALPHABET.length];
  }
  return vin;
}

const vin = (process.env.VIN ?? generateVin()).toUpperCase();
const km = Number(process.env.KM ?? 15_000);

const { viem, networkName } = await network.getOrCreate();
const publicClient = await viem.getPublicClient();
const chain = publicClient.chain;

const deployment = JSON.parse(
  readFileSync(join(HERE, "..", "deployments", `${networkName}.json`), "utf8"),
) as { address: Hex };

// The inspection shop opens the file; the garage you demo with fills it in.
const inspector = privateKeyToAccount(
  keccak256(toHex("monaddrive/demo-garage/v1/ekspertiz")),
);
const vehicleOwner = privateKeyToAccount(
  keccak256(toHex("monaddrive/demo-vehicle-owner/v1")),
).address;

const registry = getContract({
  address: deployment.address,
  abi: artifact.abi,
  client: {
    public: publicClient,
    wallet: createWalletClient({
      account: inspector,
      chain,
      transport: http(chain?.rpcUrls?.default?.http?.[0]),
    }),
  },
});

const tokenId = (await registry.read.vinToTokenId([vin])) as bigint;
if (await registry.read.isRegistered([tokenId])) {
  console.error(`${vin} zaten sicilde. VIN vermeden çalıştırın, yenisini üretsin.`);
  process.exit(1);
}

const today = (await registry.read.today()) as number;

const startedAt = Date.now();
const hash = await sendResilient((overrides) =>
  registry.write.registerVehicle(
    [vin, km, today, vehicleOwner, "", "Sicile ilk kayıt — ekspertiz temiz çıktı"],
    overrides,
  ),
);
const receipt = await publicClient.waitForTransactionReceipt({ hash });

console.log(`\n${receipt.status}  ${Date.now() - startedAt} ms`);
console.log(`\n  ŞASİ NUMARASI:  ${vin}`);
console.log(`  kilometre     :  ${km.toLocaleString("tr-TR")}`);
console.log(`  araç sahibi   :  ${vehicleOwner}  (demo, hiçbir rolü yok)`);
console.log(`\n  http://localhost:3000/vehicle/${vin}\n`);
console.log("  1. Usta hesabıyla /report -> bu şasiye bir kayıt girin");
console.log("  2. Müşteri hesabıyla yukarıdaki adrese girip raporu satın alın");
console.log("  3. Usta hesabına dönün: kazancı panelde görünür\n");
