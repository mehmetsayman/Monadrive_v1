import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  createWalletClient,
  formatEther,
  getContract,
  http,
  keccak256,
  toHex,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

import { network } from "hardhat";
import artifact from "../artifacts/contracts/VehicleRegistry.sol/VehicleRegistry.json" with { type: "json" };
import { sendResilient, warmUp } from "./rpc.js";

/**
 * Gives one garage a record on every vehicle in the demo set, so that every
 * report sale pays it something a jury can be shown.
 *
 *   npm run usta-everywhere
 *   GARAGE_LABEL=yetkili npm run usta-everywhere
 *
 * It can only act for the seeded demo garages, whose keys are derived from this
 * repository. A record belongs to whoever signed it, so a wallet that lives in
 * someone's MetaMask has to write its own - there is no way to do it for them,
 * and that is the point of the design rather than a gap in it.
 */

const HERE = dirname(fileURLToPath(import.meta.url));

const LABEL = process.env.GARAGE_LABEL ?? "ahmet";

/** Every vehicle the demo talks about. */
const VINS = [
  "WVWZZZ1JZXW000001",
  "NM0GE9F79E1234567",
  "1HGBH41JXMN109186",
  "TMBJJ7NE0J0123456",
  ...(process.env.EXTRA_VINS?.split(",").map((v) => v.trim()).filter(Boolean) ?? []),
];

const RecordType = { Maintenance: 0 } as const;

const { viem, networkName } = await network.getOrCreate();
const publicClient = await viem.getPublicClient();
const chain = publicClient.chain;

const deployment = JSON.parse(
  readFileSync(join(HERE, "..", "deployments", `${networkName}.json`), "utf8"),
) as { address: Hex };

const account = privateKeyToAccount(
  keccak256(toHex(`monaddrive/demo-garage/v1/${LABEL}`)),
);
const wallet = createWalletClient({
  account,
  chain,
  transport: http(chain?.rpcUrls?.default?.http?.[0]),
});

const registry = getContract({
  address: deployment.address,
  abi: artifact.abi,
  client: { public: publicClient, wallet },
});

const provider = (await registry.read.getServiceProvider([account.address])) as {
  name: string;
  active: boolean;
};

if (!provider.active) {
  console.error(
    `${account.address} yetkili servis değil.\nGARAGE=${account.address} GARAGE_NAME="..." npm run approve`,
  );
  process.exit(1);
}

console.log(`\nservis   ${provider.name || LABEL}`);
console.log(`adres    ${account.address}`);
console.log(`bakiye   ${formatEther(await publicClient.getBalance({ address: account.address }))} MON\n`);

await warmUp(publicClient, wallet);

const today = (await registry.read.today()) as number;
const price = (await registry.read.reportPrice()) as bigint;

for (const vin of VINS) {
  const tokenId = (await registry.read.vinToTokenId([vin])) as bigint;

  if (!(await registry.read.isRegistered([tokenId]))) {
    console.log(`  --  ${vin}  sicilde yok, atlandı`);
    continue;
  }

  const records = (await registry.read.getRecords([tokenId])) as Array<{
    reporter: Hex;
    mileage: number;
  }>;

  const already = records.filter(
    (r) => r.reporter.toLowerCase() === account.address.toLowerCase(),
  ).length;

  if (already > 0) {
    console.log(`  --  ${vin}  zaten ${already} kaydı var`);
  } else {
    // A service visit has to leave the odometer no lower than it found it.
    const mileage = Math.max(...records.map((r) => Number(r.mileage))) + 1_200;

    await sendResilient((overrides) =>
      registry.write.addRecordByVin(
        [vin, mileage, today, RecordType.Maintenance, "", "Periyodik bakım ve genel kontrol"],
        overrides,
      ),
    );
    console.log(`  ok  ${vin}  ${mileage.toLocaleString("tr-TR")} km kaydı yazıldı`);
  }

  const [beneficiaries, amounts] = (await registry.read.reportSplit([tokenId])) as [
    Hex[],
    bigint[],
  ];
  const mine = beneficiaries.findIndex(
    (b) => b.toLowerCase() === account.address.toLowerCase(),
  );

  console.log(
    `      bir satışta payı: ${formatEther(mine >= 0 ? amounts[mine] : 0n)} / ${formatEther(price)} MON`,
  );
}

console.log("\nKontrol:  npm run status\n");
