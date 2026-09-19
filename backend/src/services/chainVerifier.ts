import { ethers } from 'ethers';
import { AppError } from '../utils/AppError';

/**
 * Confirms that what a client claims happened on chain actually happened.
 *
 * The backend is deliberately not in the transaction path — the wallet talks
 * to the chain directly, and the API is told afterwards so it can keep a
 * searchable history. That left the history itself unauthenticated: any
 * logged-in caller could POST a token or transfer that never existed, name any
 * contract address, any supply, any recipient, and it would be stored and
 * surfaced as fact in dashboards and admin analytics.
 *
 * Every record endpoint now re-reads the transaction from the chain and
 * matches it against what was claimed, including that the wallet which sent it
 * is the one linked to the calling account.
 */

/**
 * Chains that work with no configuration: the local development nodes, and a
 * keyless public endpoint for Sepolia.
 *
 * The public endpoint is deliberate — the alternative was committing an
 * API-keyed provider URL to a public repository. It is rate-limited and
 * best-effort, so a deployment carrying real traffic should set
 * RPC_URL_11155111 to a dedicated provider, which overrides this.
 */
const DEFAULT_RPC_URLS: Record<string, string> = {
  '31337': 'http://127.0.0.1:8545',
  '1337': 'http://127.0.0.1:8545',
  '11155111': 'https://ethereum-sepolia-rpc.publicnode.com',
};

const TOKEN_CREATED_ABI = [
  'event TokenCreated(address indexed tokenAddress, address indexed creator, string name, string symbol, uint256 initialSupply)',
];
const ERC20_TRANSFER_ABI = ['event Transfer(address indexed from, address indexed to, uint256 value)'];

const tokenCreatedInterface = new ethers.Interface(TOKEN_CREATED_ABI);
const erc20Interface = new ethers.Interface(ERC20_TRANSFER_ABI);

const providers = new Map<string, ethers.JsonRpcProvider>();

/** `RPC_URL_<chainId>` overrides the built-in default for that chain. */
export const getRpcUrl = (chainId: string): string | undefined =>
  process.env[`RPC_URL_${chainId}`] || DEFAULT_RPC_URLS[chainId];

const getProvider = (chainId: string): ethers.JsonRpcProvider => {
  const url = getRpcUrl(chainId);
  if (!url) {
    throw new AppError(
      400,
      `Chain ${chainId} cannot be verified by this server. Set RPC_URL_${chainId} to enable it.`
    );
  }
  let provider = providers.get(chainId);
  if (!provider) {
    provider = new ethers.JsonRpcProvider(url, undefined, { staticNetwork: true });
    providers.set(chainId, provider);
  }
  return provider;
};

const sameAddress = (a?: string | null, b?: string | null): boolean =>
  !!a && !!b && a.toLowerCase() === b.toLowerCase();

/**
 * Fetches a mined, successful receipt, or explains why it can't be accepted.
 * A pending transaction is rejected rather than waited on: the client should
 * only report an action once its own wallet has confirmed it.
 */
const getSuccessfulReceipt = async (
  chainId: string,
  txHash: string
): Promise<ethers.TransactionReceipt> => {
  const provider = getProvider(chainId);

  let receipt: ethers.TransactionReceipt | null;
  try {
    receipt = await provider.getTransactionReceipt(txHash);
  } catch {
    throw new AppError(502, 'Could not reach the blockchain to verify this transaction.');
  }

  if (!receipt) {
    throw new AppError(400, 'Transaction not found on chain — it may still be pending.');
  }
  if (receipt.status !== 1) {
    throw new AppError(400, 'That transaction failed on chain and was not recorded.');
  }
  return receipt;
};

export interface TokenCreationClaim {
  txHash: string;
  chainId: string;
  /** The wallet linked to the calling account. */
  creator: string;
  contractAddress: string;
  name: string;
  symbol: string;
}

/**
 * Verifies a TokenCreated event exists in the transaction, was emitted for the
 * claimed contract address, and credits the caller's own wallet as creator.
 */
export const verifyTokenCreation = async (claim: TokenCreationClaim): Promise<void> => {
  const receipt = await getSuccessfulReceipt(claim.chainId, claim.txHash);

  if (!sameAddress(receipt.from, claim.creator)) {
    throw new AppError(400, 'That transaction was not sent by the wallet linked to your account.');
  }

  const events = receipt.logs
    .map((log) => {
      try {
        return tokenCreatedInterface.parseLog({ topics: [...log.topics], data: log.data });
      } catch {
        return null; // an unrelated log from another contract in the same tx
      }
    })
    .filter((parsed): parsed is ethers.LogDescription => parsed?.name === 'TokenCreated');

  if (events.length === 0) {
    throw new AppError(400, 'That transaction did not create a token.');
  }

  const match = events.find((event) => sameAddress(event.args.tokenAddress, claim.contractAddress));
  if (!match) {
    throw new AppError(400, 'The transaction created a different token than the one reported.');
  }
  if (!sameAddress(match.args.creator, claim.creator)) {
    throw new AppError(400, 'That token was created by a different wallet.');
  }
  if (match.args.name !== claim.name || match.args.symbol !== claim.symbol) {
    throw new AppError(400, 'The reported token name or symbol does not match the chain.');
  }
};

export interface TokenTransferClaim {
  txHash: string;
  chainId: string;
  /** The wallet linked to the calling account. */
  from: string;
  to: string;
  contractAddress: string;
}

/**
 * Verifies an ERC20 Transfer event exists in the transaction, was emitted by
 * the claimed token contract, and moved value from the caller's own wallet to
 * the reported recipient.
 */
export const verifyTokenTransfer = async (claim: TokenTransferClaim): Promise<void> => {
  const receipt = await getSuccessfulReceipt(claim.chainId, claim.txHash);

  if (!sameAddress(receipt.from, claim.from)) {
    throw new AppError(400, 'That transaction was not sent by the wallet linked to your account.');
  }

  const transfers = receipt.logs
    .filter((log) => sameAddress(log.address, claim.contractAddress))
    .map((log) => {
      try {
        return erc20Interface.parseLog({ topics: [...log.topics], data: log.data });
      } catch {
        return null;
      }
    })
    .filter((parsed): parsed is ethers.LogDescription => parsed?.name === 'Transfer');

  if (transfers.length === 0) {
    throw new AppError(400, 'That transaction contains no transfer of the reported token.');
  }

  const match = transfers.find(
    (transfer) => sameAddress(transfer.args.from, claim.from) && sameAddress(transfer.args.to, claim.to)
  );
  if (!match) {
    throw new AppError(400, 'The reported sender or recipient does not match the chain.');
  }
};
