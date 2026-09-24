import { keccak256, toBytes, type Abi } from "viem";

import abi from "./contract/abi.json";
import deployment from "./contract/deployment.json";

const registryAbi = abi as Abi;
export const registryAddress = deployment.address as `0x${string}`;

export const registry = {
  address: registryAddress,
  abi: registryAbi,
} as const;

/**
 * The record kinds, in the order the contract's enum declares them. Adding a kind
 * means appending here and in IVehicleRegistry.sol - never reordering.
 */
export const RECORD_TYPES = [
  { value: 0, label: "Periyodik bakım", tone: "good" },
  { value: 1, label: "Onarım", tone: "warn" },
  { value: 2, label: "Parça değişimi", tone: "neutral" },
  { value: 3, label: "Muayene / ekspertiz", tone: "good" },
  { value: 4, label: "Kaza kaydı", tone: "bad" },
  { value: 5, label: "Ağır hasar", tone: "bad" },
] as const;

export type RecordTone = (typeof RECORD_TYPES)[number]["tone"];

export function recordType(value: number) {
  return RECORD_TYPES[value] ?? RECORD_TYPES[2];
}

/**
 * Mirrors `vinToTokenId` in the contract. Computing it here means the buyer panel
 * can build a lookup without a round trip, and the two must agree exactly:
 * keccak256 over the raw UTF-8 bytes of the VIN.
 */
export function vinToTokenId(vin: string): bigint {
  return BigInt(keccak256(toBytes(vin)));
}

/** VINs are 17 characters, upper case, and never use I, O or Q. */
export function normalizeVin(input: string) {
  return input.toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g, "");
}

export function isCompleteVin(vin: string) {
  return normalizeVin(vin).length === 17;
}

export type VehicleSummary = {
  registered: boolean;
  owner: `0x${string}`;
  lastMileage: number;
  healthScore: number;
  recordCount: number;
  accidentCount: number;
  mintedAt: number;
  lastUpdatedAt: number;
};

export type VehicleRecord = {
  /** Block time: when the chain accepted this record. */
  recordedAt: number;
  /** Whole days since the Unix epoch: when the work was actually done. */
  serviceDay: number;
  mileage: number;
  recordType: number;
  reporter: `0x${string}`;
  ipfsCid: string;
  note: string;
};

const SECONDS_PER_DAY = 86_400;

/** The contract stores service dates as whole days; the UI wants a Date. */
export function serviceDayToDate(day: number) {
  return new Date(day * SECONDS_PER_DAY * 1000);
}

export function dateToServiceDay(date: Date) {
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / (SECONDS_PER_DAY * 1000));
}

/** Green above 80, amber to 50, red below. Matches the on-chain SVG. */
export function scoreTone(score: number): RecordTone {
  if (score >= 80) return "good";
  if (score >= 50) return "warn";
  return "bad";
}

export const TONE_TEXT: Record<RecordTone, string> = {
  good: "text-neon",
  warn: "text-amber",
  bad: "text-danger",
  neutral: "text-violet-bright",
};
