import "dotenv/config";

import type { HardhatUserConfig } from "hardhat/config";
import { configVariable } from "hardhat/config";
import hardhatToolboxViem from "@nomicfoundation/hardhat-toolbox-viem";

/**
 * The deployer key comes from `.env` when it is there, and from the encrypted
 * Hardhat keystore otherwise. `.env` is gitignored and is the convenient option for
 * a throwaway hackathon wallet; the keystore is the right one for anything else.
 */
const rawKey = process.env.MONAD_PRIVATE_KEY?.trim();

const deployerKey = rawKey
  ? // MetaMask copies the key without the 0x prefix; viem insists on it.
    ((rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`) as `0x${string}`)
  : configVariable("MONAD_PRIVATE_KEY");

const config: HardhatUserConfig = {
  plugins: [hardhatToolboxViem],
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: { enabled: true, runs: 200 },
      // The on-chain SVG renderer concatenates enough strings to blow the stack
      // without the IR pipeline.
      viaIR: true,
    },
  },
  // Sourcify needs no API key, and a verified source means a judge can read the
  // contract on the explorer instead of taking the README's word for it.
  verify: {
    sourcify: { enabled: true },
  },
  networks: {
    simulated: {
      type: "edr-simulated",
      chainType: "l1",
    },
    monadTestnet: {
      type: "http",
      chainType: "l1",
      url: "https://testnet-rpc.monad.xyz",
      chainId: 10143,
      accounts: [deployerKey],
    },
  },
};

export default config;
