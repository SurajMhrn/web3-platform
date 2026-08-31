import { z } from 'zod';
import { ethers } from 'ethers';

const ethereumAddress = (message: string) =>
  z.string().trim().refine((value) => ethers.isAddress(value), { message });

const txHash = z
  .string()
  .trim()
  .regex(/^0x[a-fA-F0-9]{64}$/, 'Invalid transaction hash');

const chainId = z.union([z.string(), z.number()]).transform((value) => String(value));

export const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const setupProfileSchema = z.object({
  username: z.string().trim().min(2, 'Username must be at least 2 characters').max(50),
  bio: z.string().trim().max(300, 'Bio must be 300 characters or fewer').optional().default(''),
  profilePicture: z
    .union([z.string().trim().url('Profile picture must be a valid URL'), z.literal('')])
    .optional()
    .default(''),
});

export const linkWalletSchema = z.object({
  walletAddress: ethereumAddress('Invalid wallet address'),
  signature: z.string().min(1, 'Signature is required'),
});

export const patchUserRoleSchema = z.object({
  role: z.enum(['user', 'admin', 'moderator'], {
    message: 'Role must be one of: user, admin, moderator',
  }),
});

export const recordTokenSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  symbol: z.string().trim().min(1, 'Symbol is required').max(10, 'Symbol must be 10 characters or fewer'),
  initialSupply: z.coerce.number().positive('Initial supply must be positive'),
  contractAddress: ethereumAddress('Invalid contract address'),
  txHash,
  chainId,
});

export const recordTokenTransferSchema = z.object({
  tokenName: z.string().trim().optional(),
  tokenSymbol: z.string().trim().optional(),
  contractAddress: ethereumAddress('Invalid contract address'),
  toAddress: ethereumAddress('Invalid recipient address'),
  amount: z.coerce.number().positive('Amount must be positive'),
  txHash,
  chainId,
});
