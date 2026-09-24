import { cookieStorage, createConfig, createStorage, http } from "wagmi";
import { injected } from "wagmi/connectors";

import { monadTestnet } from "./chain";

/**
 * Injected-only on purpose. The garage workflow assumes MetaMask on the phone;
 * adding WalletConnect would mean a project id and a QR flow nobody in a workshop
 * is going to use.
 */
export const wagmiConfig = createConfig({
  chains: [monadTestnet],
  connectors: [injected()],
  transports: {
    [monadTestnet.id]: http(),
  },
  ssr: true,
  storage: createStorage({ storage: cookieStorage }),
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
