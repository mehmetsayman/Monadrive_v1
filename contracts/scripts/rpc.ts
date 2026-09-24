import type { Hex, PublicClient, WalletClient } from "viem";

/**
 * Workarounds for the public Monad testnet RPC, all three learned by losing time
 * to them.
 *
 * The headline symptom is always the same and always a lie: a send is refused
 * with "Signer had insufficient balance" for an account that demonstrably has
 * the money. We watched one purchase fail at 0.15 MON and again at 0.55 MON for
 * a call needing 0.096.
 *
 * What actually causes it, narrowed down by experiment:
 *
 * 1. A fresh account that has never sent a transaction is refused on its first
 *    contract call. Funding it is not enough - it has to appear in a block as a
 *    *sender* before the RPC will accept a call from it. A zero-value
 *    self-transfer is enough, and after that everything works. This was
 *    reproduced twice, on two different accounts, and fixed both times.
 *
 * 2. A receipt for the funding transfer does not mean every node behind the
 *    RPC's load balancer has applied it, so spending immediately after funding
 *    can be refused for a balance that already exists.
 *
 * Two hypotheses we tested and ruled out, recorded so nobody re-tests them: it
 * is not the amount (0.55 MON failed the same way as 0.15), and it is not the
 * RPC caching a rejected transaction by hash (retrying with a nudged priority
 * fee, so different signed bytes, failed identically).
 */

/**
 * Puts a never-used account into a block as a sender, which is what the RPC
 * wants before it will accept a contract call from it. No-op once the account
 * has any transaction history, so it costs nothing on repeat runs.
 */
export async function warmUp(
  publicClient: PublicClient,
  wallet: WalletClient,
): Promise<boolean> {
  const account = wallet.account;
  if (!account) return false;

  const sent = await publicClient.getTransactionCount({ address: account.address });
  if (sent > 0) return false;

  const hash = await wallet.sendTransaction({
    account,
    chain: wallet.chain,
    to: account.address,
    value: 0n,
  });
  await publicClient.waitForTransactionReceipt({ hash });
  return true;
}

/** Polls until `address` is worth at least `minimum`, or the deadline passes. */
export async function waitForBalance(
  client: PublicClient,
  address: Hex,
  minimum: bigint,
  timeoutMs = 20_000,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if ((await client.getBalance({ address })) >= minimum) return true;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  return false;
}

type Overrides = { maxPriorityFeePerGas?: bigint };

const BASE_PRIORITY = 2_000_000_000n; // 2 gwei, viem's default here

/**
 * Retries a refused send with a slightly different priority fee. This does not
 * cure the fresh-account case above - {@link warmUp} does - but it does cover
 * the propagation window, where waiting and trying again is all that is needed.
 */
export async function sendResilient(
  submit: (overrides: Overrides) => Promise<Hex>,
  attempts = 3,
): Promise<Hex> {
  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await submit(
        attempt === 0
          ? {}
          : { maxPriorityFeePerGas: BASE_PRIORITY + BigInt(attempt) * 1_000_000n },
      );
    } catch (error) {
      lastError = error;
      if (!String(error).includes("insufficient balance")) throw error;
      await new Promise((resolve) => setTimeout(resolve, 1_500));
    }
  }

  throw lastError;
}
