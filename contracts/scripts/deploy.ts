import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { formatEther } from "viem";

import { network } from "hardhat";
import artifact from "../artifacts/contracts/VehicleRegistry.sol/VehicleRegistry.json" with { type: "json" };

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(HERE, "..", "deployments");

const { viem, networkName } = await network.getOrCreate();

const publicClient = await viem.getPublicClient();
const [deployer] = await viem.getWalletClients();

const chainId = await publicClient.getChainId();
const balance = await publicClient.getBalance({ address: deployer.account.address });

console.log(`network    ${networkName} (chainId ${chainId})`);
console.log(`deployer   ${deployer.account.address}`);
console.log(`balance    ${formatEther(balance)} MON`);

if (balance === 0n) {
  throw new Error(
    `${deployer.account.address} has no MON. Fund it from the Monad testnet faucet before deploying.`,
  );
}

const startedAt = Date.now();
const registry = await viem.deployContract("VehicleRegistry", [deployer.account.address]);
const elapsed = Date.now() - startedAt;

console.log(`\ndeployed   ${registry.address}  (${elapsed} ms)`);

const blockNumber = await publicClient.getBlockNumber();

const record = {
  network: networkName,
  chainId,
  address: registry.address,
  owner: deployer.account.address,
  deployedAtBlock: Number(blockNumber),
  deployedAt: new Date().toISOString(),
};

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(join(OUT_DIR, `${networkName}.json`), `${JSON.stringify(record, null, 2)}\n`);

// The frontend imports this rather than reaching into artifacts/, which is gitignored.
writeFileSync(
  join(OUT_DIR, "VehicleRegistry.abi.json"),
  `${JSON.stringify(artifact.abi, null, 2)}\n`,
);

console.log(`written    deployments/${networkName}.json`);
console.log(`written    deployments/VehicleRegistry.abi.json`);
