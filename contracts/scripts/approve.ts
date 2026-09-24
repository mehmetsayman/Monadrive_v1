import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { getContract, isAddress, type Hex } from "viem";

import { network } from "hardhat";
import artifact from "../artifacts/contracts/VehicleRegistry.sol/VehicleRegistry.json" with { type: "json" };

/**
 * Approves (or revokes) one garage on the registry. Only the contract owner can.
 *
 *   GARAGE=0x... GARAGE_NAME="Ahmet Oto" npm run approve
 *   GARAGE=0x... ACTIVE=false npm run approve
 */

const HERE = dirname(fileURLToPath(import.meta.url));

const garage = process.env.GARAGE;
const name = process.env.GARAGE_NAME ?? "Yetkili Servis";
const active = process.env.ACTIVE !== "false";

if (!garage || !isAddress(garage)) {
  console.error("Set GARAGE to the address to approve, e.g. GARAGE=0x... npm run approve");
  process.exit(1);
}

const { viem, networkName } = await network.getOrCreate();
const publicClient = await viem.getPublicClient();
const [owner] = await viem.getWalletClients();

const deployment = JSON.parse(
  readFileSync(join(HERE, "..", "deployments", `${networkName}.json`), "utf8"),
) as { address: Hex };

const registry = getContract({
  address: deployment.address,
  abi: artifact.abi,
  client: { public: publicClient, wallet: owner },
});

const onChainOwner = (await registry.read.owner()) as string;
if (onChainOwner.toLowerCase() !== owner.account.address.toLowerCase()) {
  console.error(
    `Only the registry owner can approve garages.\n  owner  ${onChainOwner}\n  signer ${owner.account.address}`,
  );
  process.exit(1);
}

const startedAt = Date.now();
const hash = await registry.write.setServiceProvider([garage, name, active]);
const receipt = await publicClient.waitForTransactionReceipt({ hash });

console.log(`${active ? "approved" : "revoked"}  ${garage}  "${name}"`);
console.log(`${receipt.status}  ${Date.now() - startedAt} ms  ${hash}`);
