import type { User } from '../models/user.model';

export type SafeUser = Omit<User, 'password' | 'refresh_token' | 'nonce'>;

/**
 * Strips fields that must never reach the client: password hash, refresh
 * token, and the wallet-link nonce (an internal, single-use auth artifact).
 */
export const sanitizeUser = (user: User): SafeUser => {
  const { password, refresh_token, nonce, ...safeUser } = user;
  return safeUser;
};
