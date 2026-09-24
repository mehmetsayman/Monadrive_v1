import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { formatEther, getContract, isAddress, parseEther, type Hex } from "viem";

import { network } from "hardhat";
import artifact from "../artifacts/contracts/VehicleRegistry.sol/VehicleRegistry.json" with { type: "json" };
import { sendResilient, waitForBalance } from "./rpc.js";

/**
 * Sets up a three-wallet demo on the accounts you already have in MetaMask, so a
 * recording is just switching accounts rather than importing throwaway keys.
 *
 *   USTA=0x... MUSTERI=0x... npm run roles
 *   USTA=0x... USTA_ADI="Mehmet Oto" MUSTERI=0x... npm run roles
 *
 * platform  the deployer, which owns the registry and takes the platform cut
 * usta      approved to write records, and earns a share when reports sell
 * musteri   buys reports; deliberately NOT approved, because approved garages
 *           and vehicle owners read every report for free
 */

const HERE = dirname(fileURLToPath(import.meta.url));

const USTA = process.env.USTA;
const MUSTERI = process.env.MUSTERI;
const USTA_ADI = process.env.USTA_ADI ?? "Usta Oto Servis";

/** Enough for a handful of records or report purchases at Monad's base fee. */
const TARGET = parseEther(process.env.ROLE_FUNDING ?? "0.4");

for (const [name, value] of [
  ["USTA", USTA],
  ["MUSTERI", MUSTERI],
] as const) {
  if (!value || !isAddress(value)) {
    console.error(`${name} adresi eksik veya geçersiz.\n`);
    console.error('USTA=0x... MUSTERI=0x... npm run roles');
    process.exit(1);
  }
}

const { viem, networkName } = await network.getOrCreate();
const publicClient = await viem.getPublicClient();
const [deployer] = await viem.getWalletClients();

const deployment = JSON.parse(
  readFileSync(join(HERE, "..", "deployments", `${networkName}.json`), "utf8"),
) as { address: Hex };

const registry = getContract({
  address: deployment.address,
  abi: artifact.abi,
  client: { public: publicClient, wallet: deployer },
});

const owner = (await registry.read.owner()) as Hex;
if (owner.toLowerCase() !== deployer.account.address.toLowerCase()) {
  console.error(`Rolleri yalnızca sicil sahibi kurabilir.\n  sahip  ${owner}\n  imzacı ${deployer.account.address}`);
  process.exit(1);
}

const usta = USTA as Hex;
const musteri = MUSTERI as Hex;

console.log(`\nsicil     ${deployment.address}`);
console.log(`platform  ${deployer.account.address}  (sahip)`);
console.log(`usta      ${usta}`);
console.log(`müşteri   ${musteri}\n`);

if (
  usta.toLowerCase() === musteri.toLowerCase() ||
  usta.toLowerCase() === owner.toLowerCase() ||
  musteri.toLowerCase() === owner.toLowerCase()
) {
  console.error("Üç rolün üç ayrı adres olması gerekiyor, yoksa demo akışı çöker.");
  process.exit(1);
}

// --- 1. the garage can write, the customer cannot read for free ---------------

if (await registry.read.isServiceProvider([usta])) {
  console.log("-- usta zaten yetkili");
} else {
  const hash = await sendResilient((o) =>
    registry.write.setServiceProvider([usta, USTA_ADI, true], o),
  );
  await publicClient.waitForTransactionReceipt({ hash });
  console.log(`ok usta yetkilendirildi: "${USTA_ADI}"`);
}

if (await registry.read.isServiceProvider([musteri])) {
  const hash = await sendResilient((o) =>
    registry.write.setServiceProvider([musteri, "", false], o),
  );
  await publicClient.waitForTransactionReceipt({ hash });
  console.log("ok müşterinin servis yetkisi kaldırıldı (yoksa raporları bedava görürdü)");
}

// The platform wallet is the registry owner. Leaving it approved as a garage too
// would blur the demo: it would read every report for free and its earnings
// would mix the platform cut with a garage share.
if (await registry.read.isServiceProvider([deployer.account.address])) {
  const hash = await sendResilient((o) =>
    registry.write.setServiceProvider([deployer.account.address, "", false], o),
  );
  await publicClient.waitForTransactionReceipt({ hash });
  console.log("ok platform cüzdanının servis yetkisi kaldırıldı (roller ayrışsın diye)");
}

// --- 2. both roles need gas ---------------------------------------------------

for (const [label, address] of [
  ["usta", usta],
  ["müşteri", musteri],
] as const) {
  const balance = await publicClient.getBalance({ address });
  if (balance >= TARGET) {
    console.log(`-- ${label} bakiyesi yeterli (${formatEther(balance)} MON)`);
    continue;
  }

  const topUp = TARGET - balance;
  const hash = await sendResilient((o) =>
    deployer.sendTransaction({ to: address, value: topUp, ...o }),
  );
  await publicClient.waitForTransactionReceipt({ hash });
  await waitForBalance(publicClient, address, TARGET);
  console.log(`ok ${label} hesabına ${formatEther(topUp)} MON gönderildi`);
}

// --- 3. the one thing we cannot do for them ----------------------------------

const cold: string[] = [];
for (const [label, address] of [
  ["usta", usta],
  ["müşteri", musteri],
] as const) {
  if ((await publicClient.getTransactionCount({ address })) === 0) cold.push(label);
}

console.log("\nHAZIR.");
console.log(`  usta     ${usta}  -> /report, kayıt girer, kazancını görür`);
console.log(`  müşteri  ${musteri}  -> /vehicle/..., raporu satın alır`);
console.log(`  platform ${deployer.account.address}  -> %30 pay`);

if (cold.length > 0) {
  console.log(`\n  DİKKAT: ${cold.join(" ve ")} hesabı hiç işlem göndermemiş.`);
  console.log("  Monad RPC'si böyle bir hesabın ilk kontrat çağrısını reddediyor.");
  console.log("  MetaMask'te o hesaba geçip kendine 0 MON gönderin; bir kez yeter.");
}

console.log("\n  Kimin ne kazandığını görmek için:  npm run status\n");
