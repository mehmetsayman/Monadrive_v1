import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";

import { parseEther, toFunctionSelector } from "viem";

import { network } from "hardhat";

const VIN = "WVWZZZ1JZXW000001";
const OTHER_VIN = "NM0GE9F79E1234567";

const RecordType = {
  Maintenance: 0,
  Repair: 1,
  PartReplacement: 2,
  Inspection: 3,
  Accident: 4,
  HeavyDamage: 5,
} as const;

/**
 * Signatures of every custom error the tests assert on. The simulated network does
 * not always decode a custom error back into its name, so we match the 4-byte
 * selector as well as the name.
 */
const ERROR_SIGNATURES = {
  NotAuthorizedService: "NotAuthorizedService(address)",
  MileageRollback: "MileageRollback(uint32,uint32)",
  VehicleNotFound: "VehicleNotFound(uint256)",
  VehicleAlreadyRegistered: "VehicleAlreadyRegistered(uint256)",
  EmptyVin: "EmptyVin()",
  InsufficientPayment: "InsufficientPayment(uint256,uint256)",
  AlreadyPurchased: "AlreadyPurchased(uint256,address)",
  NothingToWithdraw: "NothingToWithdraw(address)",
  ShareOutOfRange: "ShareOutOfRange(uint16)",
  FutureServiceDate: "FutureServiceDate(uint16,uint16)",
  OwnableUnauthorizedAccount: "OwnableUnauthorizedAccount(address)",
} as const;

async function expectRevert(
  promise: Promise<unknown>,
  errorName: keyof typeof ERROR_SIGNATURES,
) {
  const selector = toFunctionSelector(ERROR_SIGNATURES[errorName]);

  try {
    await promise;
  } catch (error) {
    const message = String(error);
    assert.ok(
      message.includes(errorName) || message.includes(selector),
      `expected revert with ${errorName} (${selector}), got:\n${message}`,
    );
    return;
  }
  assert.fail(`expected revert with ${errorName}, but the call succeeded`);
}

describe("VehicleRegistry", async () => {
  // A fresh registry is deployed per test, so one shared connection is enough.
  const { viem } = await network.getOrCreate({ network: "simulated", chainType: "l1" });

  let registry: Awaited<ReturnType<typeof deploy>>["registry"];
  let deployer: Awaited<ReturnType<typeof deploy>>["deployer"];
  let garage: Awaited<ReturnType<typeof deploy>>["garage"];
  let stranger: Awaited<ReturnType<typeof deploy>>["stranger"];
  let carOwner: Awaited<ReturnType<typeof deploy>>["carOwner"];
  let buyer: Awaited<ReturnType<typeof deploy>>["buyer"];
  let garage2: Awaited<ReturnType<typeof deploy>>["garage2"];

  const PRICE = parseEther("0.05");
  const PLATFORM_BPS = 3_000; // 30% platform, 70% to the garages

  async function deploy() {
    const [deployer, garage, stranger, carOwner, buyer, garage2] =
      await viem.getWalletClients();
    const registry = await viem.deployContract("VehicleRegistry", [
      deployer.account.address,
      PRICE,
      PLATFORM_BPS,
    ]);
    return { registry, deployer, garage, stranger, carOwner, buyer, garage2 };
  }

  beforeEach(async () => {
    ({ registry, deployer, garage, stranger, carOwner, buyer, garage2 } = await deploy());
    await registry.write.setServiceProvider([
      garage.account.address,
      "Ahmet Oto Servis",
      true,
    ]);
  });

  /** Registers VIN with a genesis inspection at `mileage`. */
  async function register(mileage: number, owner?: `0x${string}`) {
    await registry.write.registerVehicle(
      [VIN, mileage, 0, owner ?? carOwner.account.address, "", "Sicile ilk kayit"],
      { account: garage.account },
    );
    return registry.read.vinToTokenId([VIN]);
  }

  describe("service provider allowlist", () => {
    it("only the owner can approve a garage", async () => {
      await expectRevert(
        registry.write.setServiceProvider(
          [stranger.account.address, "Korsan Servis", true],
          { account: stranger.account },
        ),
        "OwnableUnauthorizedAccount",
      );
    });

    it("rejects writes from an address that was never approved", async () => {
      await expectRevert(
        registry.write.registerVehicle([VIN, 10_000, 0, carOwner.account.address, "", ""], {
          account: stranger.account,
        }),
        "NotAuthorizedService",
      );
    });

    it("rejects writes from a garage whose licence was revoked", async () => {
      await register(10_000);
      await registry.write.setServiceProvider([
        garage.account.address,
        "Ahmet Oto Servis",
        false,
      ]);

      await expectRevert(
        registry.write.addRecordByVin(
          [VIN, 20_000, 0, RecordType.Maintenance, "", ""], {
          account: garage.account,
        }),
        "NotAuthorizedService",
      );
    });

    it("keeps the records a revoked garage already wrote", async () => {
      const tokenId = await register(10_000);
      await registry.write.setServiceProvider([
        garage.account.address,
        "Ahmet Oto Servis",
        false,
      ]);

      const records = await registry.read.getRecords([tokenId]);
      assert.equal(records.length, 1);
      assert.equal(records[0].mileage, 10_000);
    });
  });

  describe("registration", () => {
    it("mints the vehicle to its owner and opens the timeline", async () => {
      const tokenId = await register(10_000);

      assert.equal(
        (await registry.read.ownerOf([tokenId])).toLowerCase(),
        carOwner.account.address.toLowerCase(),
      );

      const records = await registry.read.getRecords([tokenId]);
      assert.equal(records.length, 1, "genesis record is missing");
      assert.equal(records[0].recordType, RecordType.Inspection);
      assert.equal(records[0].mileage, 10_000);
    });

    it("derives the same token id from the same VIN", async () => {
      const a = await registry.read.vinToTokenId([VIN]);
      const b = await registry.read.vinToTokenId([VIN]);
      const c = await registry.read.vinToTokenId([OTHER_VIN]);

      assert.equal(a, b);
      assert.notEqual(a, c);
    });

    it("refuses an empty VIN", async () => {
      await expectRevert(registry.read.vinToTokenId([""]), "EmptyVin");
    });

    it("refuses to register the same VIN twice", async () => {
      await register(10_000);
      await expectRevert(
        registry.write.registerVehicle([VIN, 5_000, 0, carOwner.account.address, "", ""], {
          account: garage.account,
        }),
        "VehicleAlreadyRegistered",
      );
    });

    it("refuses records for a VIN that was never registered", async () => {
      await expectRevert(
        registry.write.addRecordByVin(
          [OTHER_VIN, 10_000, 0, RecordType.Maintenance, "", ""],
          { account: garage.account },
        ),
        "VehicleNotFound",
      );
    });
  });

  describe("the mileage guarantee", () => {
    it("accepts mileage that moves forward", async () => {
      const tokenId = await register(10_000);

      await registry.write.addRecordByVin(
          [VIN, 42_500, 0, RecordType.Maintenance, "", "Yag ve filtre"],
        { account: garage.account },
      );

      const summary = await registry.read.getVehicleSummary([tokenId]);
      assert.equal(summary.lastMileage, 42_500);
    });

    it("accepts a second record at the same mileage", async () => {
      await register(10_000);

      await registry.write.addRecordByVin(
          [VIN, 10_000, 0, RecordType.PartReplacement, "", "Ayni ziyaret"],
        { account: garage.account },
      );

      const summary = await registry.read.getVehicleSummaryByVin([VIN]);
      assert.equal(summary.recordCount, 2);
    });

    it("REJECTS a wound-back odometer", async () => {
      await register(120_000);

      await expectRevert(
        registry.write.addRecordByVin(
          [VIN, 65_000, 0, RecordType.Maintenance, "", "Kilometre dusurme denemesi"],
          { account: garage.account },
        ),
        "MileageRollback",
      );
    });

    it("leaves the recorded mileage untouched after a rejected rollback", async () => {
      const tokenId = await register(120_000);

      await expectRevert(
        registry.write.addRecordByVin(
          [VIN, 65_000, 0, RecordType.Maintenance, "", ""], {
          account: garage.account,
        }),
        "MileageRollback",
      );

      const summary = await registry.read.getVehicleSummary([tokenId]);
      assert.equal(summary.lastMileage, 120_000);
      assert.equal(summary.recordCount, 1);
    });
  });

  describe("service date", () => {
    it("keeps the day the work was done apart from the day it was recorded", async () => {
      const tokenId = await register(10_000);
      const today = await registry.read.today();
      const lastYear = today - 400;

      await registry.write.addRecordByVin(
        [VIN, 42_500, lastYear, RecordType.Maintenance, "", "Gecen yilki bakim"],
        { account: garage.account },
      );

      const records = await registry.read.getRecords([tokenId]);
      const backfilled = records[1];

      assert.equal(backfilled.serviceDay, lastYear, "service day was not kept");
      assert.ok(
        backfilled.recordedAt > 0 && backfilled.serviceDay * 86_400 < backfilled.recordedAt,
        "a backfilled record should be dated before the block that carried it",
      );
    });

    it("treats day zero as today, so the garage can leave it blank", async () => {
      const tokenId = await register(10_000);
      const today = await registry.read.today();

      await registry.write.addRecordByVin(
        [VIN, 20_000, 0, RecordType.Maintenance, "", ""],
        { account: garage.account },
      );

      const records = await registry.read.getRecords([tokenId]);
      assert.equal(records[1].serviceDay, today);
    });

    it("refuses work dated in the future", async () => {
      await register(10_000);
      const today = await registry.read.today();

      await expectRevert(
        registry.write.addRecordByVin(
          [VIN, 20_000, today + 1, RecordType.Maintenance, "", "Yarinki bakim"],
          { account: garage.account },
        ),
        "FutureServiceDate",
      );
    });
  });

  describe("health score", () => {
    it("starts a clean vehicle at 100", async () => {
      const tokenId = await register(10_000);
      assert.equal(await registry.read.healthScore([tokenId]), 100);
    });

    it("drops on an accident and further on heavy damage", async () => {
      const tokenId = await register(10_000);

      await registry.write.addRecordByVin(
          [VIN, 20_000, 0, RecordType.Accident, "", "Arka tampon"],
        { account: garage.account },
      );
      const afterAccident = await registry.read.healthScore([tokenId]);

      await registry.write.addRecordByVin(
          [VIN, 30_000, 0, RecordType.HeavyDamage, "", "Sasi hasari"],
        { account: garage.account },
      );
      const afterHeavy = await registry.read.healthScore([tokenId]);

      assert.ok(afterAccident < 100, "accident did not lower the score");
      assert.ok(afterHeavy < afterAccident, "heavy damage did not lower it further");

      const summary = await registry.read.getVehicleSummary([tokenId]);
      assert.equal(summary.accidentCount, 2);
    });

    it("cannot be scrubbed clean by spamming maintenance records", async () => {
      const tokenId = await register(10_000);

      await registry.write.addRecordByVin(
          [VIN, 20_000, 0, RecordType.HeavyDamage, "", ""], {
        account: garage.account,
      });
      const damaged = await registry.read.healthScore([tokenId]);

      for (let i = 0; i < 40; i++) {
        await registry.write.addRecordByVin(
          [VIN, 20_000 + i * 100, 0, RecordType.Maintenance, "", ""],
          { account: garage.account },
        );
      }
      const afterSpam = await registry.read.healthScore([tokenId]);

      assert.ok(afterSpam > damaged, "care should count for something");
      assert.ok(
        afterSpam <= 100 - 30 + 10,
        `maintenance offset more than the cap: ${afterSpam}`,
      );
    });
  });

  describe("reads for the buyer panel", () => {
    it("reports an unknown VIN as an empty state, not an error", async () => {
      const summary = await registry.read.getVehicleSummaryByVin([OTHER_VIN]);
      assert.equal(summary.registered, false);
      assert.equal(summary.recordCount, 0);
    });

    it("returns the history newest-first when paged", async () => {
      await register(10_000);
      await registry.write.addRecordByVin(
          [VIN, 20_000, 0, RecordType.Maintenance, "", ""], {
        account: garage.account,
      });
      await registry.write.addRecordByVin(
          [VIN, 30_000, 0, RecordType.Repair, "", ""], {
        account: garage.account,
      });

      const tokenId = await registry.read.vinToTokenId([VIN]);
      const [page, total] = await registry.read.getRecordsPaged([tokenId, 0n, 2n]);

      assert.equal(total, 3n);
      assert.equal(page.length, 2);
      assert.equal(page[0].mileage, 30_000, "newest record should come first");
      assert.equal(page[1].mileage, 20_000);
    });

    it("names the garage behind a record", async () => {
      const tokenId = await register(10_000);
      assert.equal(await registry.read.reporterName([tokenId, 0n]), "Ahmet Oto Servis");
    });
  });

  describe("paid reports", () => {
    /** Adds a second approved garage and gives it one record on VIN. */
    async function addSecondGarage(mileage: number) {
      await registry.write.setServiceProvider([
        garage2.account.address,
        "Yetkili Servis",
        true,
      ]);
      await registry.write.addRecordByVin(
        [VIN, mileage, 0, RecordType.Maintenance, "", ""],
        { account: garage2.account },
      );
    }

    it("locks the full report until it is bought", async () => {
      const tokenId = await register(10_000);
      assert.equal(
        await registry.read.hasReportAccess([tokenId, buyer.account.address]),
        false,
      );
    });

    it("opens the report permanently once bought", async () => {
      const tokenId = await register(10_000);

      await registry.write.purchaseReport([tokenId], {
        account: buyer.account,
        value: PRICE,
      });

      assert.equal(
        await registry.read.hasReportAccess([tokenId, buyer.account.address]),
        true,
      );
    });

    it("refuses to charge the same buyer twice for the same car", async () => {
      const tokenId = await register(10_000);
      await registry.write.purchaseReport([tokenId], {
        account: buyer.account,
        value: PRICE,
      });

      await expectRevert(
        registry.write.purchaseReport([tokenId], {
          account: buyer.account,
          value: PRICE,
        }),
        "AlreadyPurchased",
      );
    });

    it("rejects underpayment", async () => {
      const tokenId = await register(10_000);
      await expectRevert(
        registry.write.purchaseReport([tokenId], {
          account: buyer.account,
          value: PRICE - 1n,
        }),
        "InsufficientPayment",
      );
    });

    it("refunds overpayment instead of keeping it", async () => {
      const tokenId = await register(10_000);
      const publicClient = await viem.getPublicClient();

      const before = await publicClient.getBalance({ address: buyer.account.address });
      const hash = await registry.write.purchaseReport([tokenId], {
        account: buyer.account,
        value: PRICE * 3n,
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      const after = await publicClient.getBalance({ address: buyer.account.address });

      const gas = receipt.gasUsed * receipt.effectiveGasPrice;
      assert.equal(before - after - gas, PRICE, "buyer was charged more than the price");
    });

    it("gives the vehicle's own owner the report for free", async () => {
      const tokenId = await register(10_000);
      assert.equal(
        await registry.read.hasReportAccess([tokenId, carOwner.account.address]),
        true,
      );
    });

    it("gives an approved garage the report for free", async () => {
      const tokenId = await register(10_000);
      assert.equal(
        await registry.read.hasReportAccess([tokenId, garage.account.address]),
        true,
      );
    });

    it("splits a sale between the platform and the garages that wrote the history", async () => {
      const tokenId = await register(10_000);
      await addSecondGarage(20_000); // now: garage 1 record, garage2 1 record

      await registry.write.purchaseReport([tokenId], {
        account: buyer.account,
        value: PRICE,
      });

      const platformCut = (PRICE * BigInt(PLATFORM_BPS)) / 10_000n;
      const garagePool = PRICE - platformCut;

      const one = await registry.read.earnings([garage.account.address]);
      const two = await registry.read.earnings([garage2.account.address]);

      assert.equal(one, garagePool / 2n, "first garage's share is wrong");
      assert.equal(two, garagePool / 2n, "second garage's share is wrong");
      assert.equal(
        one + two + platformCut,
        PRICE,
        "the split does not add up to the price",
      );
    });

    it("pays the platform its cut straight into the wallet, not a balance", async () => {
      const tokenId = await register(10_000);
      const publicClient = await viem.getPublicClient();

      const before = await publicClient.getBalance({ address: deployer.account.address });

      await registry.write.purchaseReport([tokenId], {
        account: buyer.account,
        value: PRICE,
      });

      const after = await publicClient.getBalance({ address: deployer.account.address });
      const platformCut = (PRICE * BigInt(PLATFORM_BPS)) / 10_000n;

      // The owner signed nothing here, so no gas muddies the comparison.
      assert.equal(after - before, platformCut, "platform was not paid on the spot");
      assert.equal(
        await registry.read.earnings([deployer.account.address]),
        0n,
        "nothing should be left waiting to be withdrawn",
      );
    });

    it("weights the split by how much of the history each garage wrote", async () => {
      const tokenId = await register(10_000);
      // garage now has 1 record; give it two more, then garage2 one.
      await registry.write.addRecordByVin(
        [VIN, 20_000, 0, RecordType.Maintenance, "", ""],
        { account: garage.account },
      );
      await registry.write.addRecordByVin(
        [VIN, 30_000, 0, RecordType.Maintenance, "", ""],
        { account: garage.account },
      );
      await addSecondGarage(40_000); // 3 vs 1, out of 4 records

      await registry.write.purchaseReport([tokenId], {
        account: buyer.account,
        value: PRICE,
      });

      const one = await registry.read.earnings([garage.account.address]);
      const two = await registry.read.earnings([garage2.account.address]);

      assert.equal(one, two * 3n, "shares should follow the record counts");
    });

    it("pays out on withdrawal and leaves the balance at zero", async () => {
      const tokenId = await register(10_000);
      await registry.write.purchaseReport([tokenId], {
        account: buyer.account,
        value: PRICE,
      });

      const publicClient = await viem.getPublicClient();
      const owed = await registry.read.earnings([garage.account.address]);
      assert.ok(owed > 0n, "the garage should be owed something");

      const before = await publicClient.getBalance({ address: garage.account.address });
      const hash = await registry.write.withdrawEarnings({ account: garage.account });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      const after = await publicClient.getBalance({ address: garage.account.address });

      const gas = receipt.gasUsed * receipt.effectiveGasPrice;
      assert.equal(after - before + gas, owed, "payout did not match the balance");
      assert.equal(await registry.read.earnings([garage.account.address]), 0n);
    });

    it("refuses a withdrawal with nothing owed", async () => {
      await expectRevert(
        registry.write.withdrawEarnings({ account: stranger.account }),
        "NothingToWithdraw",
      );
    });

    it("lets only the owner move the price", async () => {
      await expectRevert(
        registry.write.setReportPrice([parseEther("1")], { account: stranger.account }),
        "OwnableUnauthorizedAccount",
      );

      await registry.write.setReportPrice([parseEther("0.1")]);
      assert.equal(await registry.read.reportPrice(), parseEther("0.1"));
    });

    it("refuses a platform share above 100%", async () => {
      await expectRevert(registry.write.setPlatformShare([10_001]), "ShareOutOfRange");
    });

    it("previews the split without anyone paying", async () => {
      const tokenId = await register(10_000);
      await addSecondGarage(20_000);

      const [beneficiaries, amounts] = await registry.read.reportSplit([tokenId]);

      assert.equal(beneficiaries.length, 3, "two garages plus the platform");
      assert.equal(
        amounts.reduce((total: bigint, amount: bigint) => total + amount, 0n),
        PRICE,
      );
    });
  });

  describe("dynamic metadata", () => {
    it("serves on-chain metadata that changes as history accumulates", async () => {
      const tokenId = await register(10_000);
      const before = await registry.read.tokenURI([tokenId]);

      assert.ok(
        before.startsWith("data:application/json;base64,"),
        "metadata should be rendered on chain",
      );

      await registry.write.addRecordByVin(
          [VIN, 90_000, 0, RecordType.Accident, "", ""], {
        account: garage.account,
      });
      const after = await registry.read.tokenURI([tokenId]);

      assert.notEqual(before, after, "metadata did not react to the new record");

      const decode = (uri: string) =>
        JSON.parse(
          Buffer.from(
            uri.replace("data:application/json;base64,", ""),
            "base64",
          ).toString("utf8"),
        );

      const meta = decode(after);
      const mileage = meta.attributes.find(
        (a: { trait_type: string }) => a.trait_type === "Mileage",
      );
      assert.equal(mileage.value, 90_000);
    });
  });
});
