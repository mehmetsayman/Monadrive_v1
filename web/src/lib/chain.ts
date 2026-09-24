import { defineChain } from "viem";

import deployment from "./contract/deployment.json";

/**
 * Monad testnet. Defined here rather than imported from viem/chains so the RPC
 * and explorer stay pinned to what the deploy actually used.
 */
export const monadTestnet = defineChain({
  id: deployment.chainId,
  name: "Monad Testnet",
  nativeCurrency: { name: "Monad", symbol: "MON", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://testnet-rpc.monad.xyz"] },
  },
  blockExplorers: {
    default: { name: "Monad Explorer", url: "https://testnet.monadexplorer.com" },
  },
  testnet: true,
});

export function explorerTx(hash: string) {
  return `${monadTestnet.blockExplorers.default.url}/tx/${hash}`;
}

export function explorerAddress(address: string) {
  return `${monadTestnet.blockExplorers.default.url}/address/${address}`;
}
