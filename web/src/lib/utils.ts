import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** 88100 -> "88.100" */
export function formatKm(value: number | bigint) {
  return Number(value).toLocaleString("tr-TR");
}

/** 0x1c6ecefd...db944 -> "0x1c6e...b944" */
export function shortAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function formatDate(timestamp: number | bigint) {
  return new Date(Number(timestamp) * 1000).toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}
