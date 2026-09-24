import { keccak256, toBytes, type Abi } from "viem";

import abi from "./contract/abi.json";
import deployment from "./contract/deployment.json";

export const registryAbi = abi as Abi;
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
  timestamp: number;
  mileage: number;
  recordType: number;
  reporter: `0x${string}`;
  ipfsCid: string;
  note: string;
};

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

export const TONE_BORDER: Record<RecordTone, string> = {
  good: "border-neon/40",
  warn: "border-amber/40",
  bad: "border-danger/40",
  neutral: "border-violet/40",
};
