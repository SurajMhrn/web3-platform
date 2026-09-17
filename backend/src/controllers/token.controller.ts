import { Response } from 'express';
import {
  getTokensByUserId,
  getAllTokens,
  getTotalTokenCount,
  createToken,
} from '../models/token.model';
import { createTransaction } from '../models/transaction.model';
import { createNotification } from '../models/notification.model';
import { withTransaction } from '../config/db';
import { asyncHandler } from '../utils/asyncHandler';
import { parsePagination } from '../utils/pagination';
import { AppError } from '../utils/AppError';
import { getUserById } from '../models/user.model';
import { verifyTokenCreation, verifyTokenTransfer } from '../services/chainVerifier';
import type { AuthRequest } from '../middleware/auth.middleware';

/**
 * The wallet an on-chain claim must have come from. Verification is only
 * meaningful against an identity the account has already proven it controls,
 * which is what wallet linking establishes.
 */
const requireLinkedWallet = async (userId: string): Promise<string> => {
  const user = await getUserById(userId);
  if (!user?.wallet_address) {
    throw new AppError(400, 'Link a wallet to your account before recording on-chain activity.');
  }
  return user.wallet_address;
};

/**
 * GET /api/tokens
 * Returns the current user's tokens.
 */
export const getUserTokens = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const tokens = await getTokensByUserId(userId);
  res.json({ tokens });
});

/**
 * POST /api/tokens/record
 * Records a newly deployed token in the database (called after a successful
 * on-chain deployment from the frontend). Body validated by
 * `validateBody(recordTokenSchema)` — name/symbol/initialSupply/contractAddress
 * (checksummed-address format)/txHash/chainId are all guaranteed present and
 * well-formed by the time this runs.
 *
 * The token row, the transaction-history row, and the notification are
 * written inside a single DB transaction so a failure partway through never
 * leaves an orphaned token with no matching transaction/notification.
 */
export const recordToken = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const { name, symbol, initialSupply, contractAddress, txHash, chainId } = req.body;

  const wallet = await requireLinkedWallet(userId);
  await verifyTokenCreation({ txHash, chainId, creator: wallet, contractAddress, name, symbol });

  const token = await withTransaction(async () => {
    const created = await createToken(
      userId,
      name,
      symbol,
      initialSupply,
      contractAddress,
      txHash,
      chainId
    );

    await createTransaction(
      userId,
      'token_creation',
      txHash,
      chainId,
      `Created token ${name} (${symbol})`,
      { contractAddress, initialSupply }
    );

    await createNotification(
      userId,
      'token_created',
      '🪙 Token Created',
      `Your token ${name} (${symbol}) has been successfully deployed with ${initialSupply} initial supply.`,
      '/tokens'
    );

    return created;
  });

  res.status(201).json({ token });
});

/**
 * POST /api/tokens/transfer-record
 * Records a token transfer transaction (called after a successful on-chain
 * transfer). Body validated by `validateBody(recordTokenTransferSchema)`.
 */
export const recordTokenTransfer = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const { tokenName, tokenSymbol, contractAddress, toAddress, amount, txHash, chainId } = req.body;

  const wallet = await requireLinkedWallet(userId);
  await verifyTokenTransfer({ txHash, chainId, from: wallet, to: toAddress, contractAddress });

  const shortTo = `${toAddress.slice(0, 6)}...${toAddress.slice(-4)}`;

  const transaction = await withTransaction(async () => {
    const created = await createTransaction(
      userId,
      'token_transfer',
      txHash,
      chainId,
      `Transferred ${amount} ${tokenSymbol || 'tokens'} to ${shortTo}`,
      { contractAddress, toAddress, amount, tokenName, tokenSymbol }
    );

    await createNotification(
      userId,
      'token_transferred',
      '↗️ Token Transfer',
      `Successfully transferred ${amount} ${tokenSymbol || 'tokens'} to ${shortTo}.`,
      '/transactions'
    );

    return created;
  });

  res.json({ transaction });
});

/**
 * GET /api/admin/tokens
 * Returns all platform tokens (admin only).
 */
export const getAdminTokens = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { limit, offset } = parsePagination(req, { defaultLimit: 50, maxLimit: 200 });
  const [tokens, total] = await Promise.all([getAllTokens(limit, offset), getTotalTokenCount()]);
  res.json({ tokens, total, limit, offset });
});
