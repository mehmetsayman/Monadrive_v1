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
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

import { network } from "hardhat";
import artifact from "../artifacts/contracts/VehicleRegistry.sol/VehicleRegistry.json" with { type: "json" };
import { sendResilient, waitForBalance, warmUp } from "./rpc.js";

/**
 * Buys a report as a demo customer, so the money actually moves and the garages
 * have something to show in their earnings card.
 *
 *   npm run buy                       # the heavy-damage demo car
 *   VIN=WVWZZZ1JZXW000001 npm run buy
 *   BUYER=2 npm run buy               # a different demo buyer, to buy again
 *
 * The buyer is a throwaway derived account, funded from the deployer. It cannot
 * be an approved garage or the vehicle's owner - both of those read for free.
 */

const HERE = dirname(fileURLToPath(import.meta.url));

const VIN = process.env.VIN ?? "1HGBH41JXMN109186";
const BUYER = process.env.BUYER ?? "1";

const buyerKey = keccak256(toHex(`monaddrive/demo-buyer/v1/${BUYER}`));

const { viem, networkName } = await network.getOrCreate();
const publicClient = await viem.getPublicClient();
const [deployer] = await viem.getWalletClients();
const chain = publicClient.chain;

const deployment = JSON.parse(
  readFileSync(join(HERE, "..", "deployments", `${networkName}.json`), "utf8"),
) as { address: Hex };

const abi = artifact.abi;
const buyer = privateKeyToAccount(buyerKey);
const buyerWallet = createWalletClient({
  account: buyer,
  chain,
  transport: http(chain?.rpcUrls?.default?.http?.[0]),
});

const asBuyer = getContract({
  address: deployment.address,
  abi,
  client: { public: publicClient, wallet: buyerWallet },
});
const asAnyone = getContract({
  address: deployment.address,
  abi,
  client: { public: publicClient },
});

const price = (await asAnyone.read.reportPrice()) as bigint;
const tokenId = (await asAnyone.read.vinToTokenId([VIN])) as bigint;

if (!(await asAnyone.read.isRegistered([tokenId]))) {
  console.error(`${VIN} sicilde kayıtlı değil. Önce: npm run seed`);
  process.exit(1);
}

if (await asAnyone.read.hasReportAccess([tokenId, buyer.address])) {
  console.error(
    `${buyer.address} bu raporu zaten açmış.\nBaşka bir alıcı deneyin: BUYER=2 npm run buy`,
  );
  process.exit(1);
}

console.log(`alıcı   ${buyer.address}`);
console.log(`araç    ${VIN}`);
console.log(`fiyat   ${formatEther(price)} MON\n`);

// Enough for the price plus a generous gas reservation on Monad's base fee.
const needed = price + parseEther("0.1");
const balance = await publicClient.getBalance({ address: buyer.address });

if (balance < needed) {
  const topUp = needed - balance;
  console.log(`alıcıya ${formatEther(topUp)} MON gönderiliyor...`);
  const fundHash = await deployer.sendTransaction({ to: buyer.address, value: topUp });
  await publicClient.waitForTransactionReceipt({ hash: fundHash });

  // A receipt is not the same as every node having seen it. See scripts/rpc.ts.
  if (!(await waitForBalance(publicClient, buyer.address, needed))) {
    console.error("Fonlama göründü ama bakiye RPC'de belirmedi. Birkaç saniye sonra tekrar deneyin.");
    process.exit(1);
  }
}

// The RPC refuses a fresh account's first contract call until it has sent
// something itself. See scripts/rpc.ts.
if (await warmUp(publicClient, buyerWallet)) {
  console.log("alıcı hesabı ısıtıldı (ilk işlem)");
}

const before = (await asAnyone.read.reportSplit([tokenId])) as [Hex[], bigint[]];

const startedAt = Date.now();
const hash = await sendResilient((overrides) =>
  asBuyer.write.purchaseReport([tokenId], { value: price, ...overrides }),
);
const receipt = await publicClient.waitForTransactionReceipt({ hash });
const elapsed = Date.now() - startedAt;

console.log(`${receipt.status}  ${elapsed} ms  ${hash}\n`);
console.log("bu satış şöyle bölüşüldü:");

for (let i = 0; i < before[0].length; i++) {
  const address = before[0][i];
  const share = before[1][i];
  if (share === 0n) continue;

  const name = (await asAnyone.read.getServiceProvider([address])) as { name: string };
  const label = name.name || "platform";
  console.log(`  ${formatEther(share).padStart(8)} MON  ${label.padEnd(24)} ${address}`);
}

console.log("\nKimin ne kazandığını görmek için:  npm run status");
console.log("Usta panelinde göstermek için o servisin cüzdanını MetaMask'e alın:");
console.log("  npm run keys\n");
