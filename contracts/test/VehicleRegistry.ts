import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";

import { toFunctionSelector } from "viem";

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

  async function deploy() {
    const [deployer, garage, stranger, carOwner] = await viem.getWalletClients();
    const registry = await viem.deployContract("VehicleRegistry", [
      deployer.account.address,
    ]);
    return { registry, deployer, garage, stranger, carOwner };
  }

  beforeEach(async () => {
    ({ registry, deployer, garage, stranger, carOwner } = await deploy());
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
