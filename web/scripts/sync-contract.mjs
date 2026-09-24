/**
 * Copies the deployed address and ABI out of ../contracts/deployments so the
 * frontend never reaches across package boundaries at build time. Re-run after
 * every deploy: `npm run sync:contract`.
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const FROM = join(HERE, "..", "..", "contracts", "deployments");
const TO = join(HERE, "..", "src", "lib", "contract");

const NETWORK = process.env.NETWORK ?? "monadTestnet";

const deploymentFile = join(FROM, `${NETWORK}.json`);
const abiFile = join(FROM, "VehicleRegistry.abi.json");

for (const file of [deploymentFile, abiFile]) {
  if (!existsSync(file)) {
    console.error(`missing ${file}\nDeploy the contracts first: cd ../contracts && npm run deploy`);
    process.exit(1);
  }
}

mkdirSync(TO, { recursive: true });
copyFileSync(deploymentFile, join(TO, "deployment.json"));
copyFileSync(abiFile, join(TO, "abi.json"));

const { address, chainId } = JSON.parse(readFileSync(deploymentFile, "utf8"));
console.log(`synced ${address} on chain ${chainId} -> src/lib/contract/`);
