/**
 * Centralized environment configuration. Fails fast at startup if a required
 * secret is missing, instead of silently falling back to a hardcoded value
 * (the previous behavior in auth.controller.ts / auth.middleware.ts, which
 * meant a misconfigured deployment would run "successfully" while signing
 * tokens with a well-known, publicly-visible secret).
 */

const MIN_SECRET_LENGTH = 32;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. Copy backend/.env.example to backend/.env and fill it in.`
    );
  }
  return value;
}

/**
 * Warns (doesn't fail) on a weak secret — long enough to boot a dev
 * environment quickly, but a deployment running with a short/guessable
 * secret should know about it rather than silently ship one.
 */
function checkSecretStrength(name: string, value: string): void {
  if (value.length < MIN_SECRET_LENGTH) {
    console.warn(
      `[Security] ${name} is only ${value.length} characters — use at least ${MIN_SECRET_LENGTH} random ` +
        `characters in production. Generate one with: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`
    );
  }
}

const jwtSecret = requireEnv('JWT_SECRET');
const refreshSecret = requireEnv('REFRESH_SECRET');
checkSecretStrength('JWT_SECRET', jwtSecret);
checkSecretStrength('REFRESH_SECRET', refreshSecret);

export const env = {
  port: process.env.PORT || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  jwtSecret,
  refreshSecret,
  adminEmail: process.env.ADMIN_EMAIL || 'admin@web3platform.com',
  adminPassword: process.env.ADMIN_PASSWORD,
};
