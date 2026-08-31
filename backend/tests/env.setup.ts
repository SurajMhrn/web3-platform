// Runs before each test file's imports (Jest `setupFiles`), so `src/config/env.ts`'s
// fail-fast checks see these values, and `src/config/db.ts` never touches the real
// `web3_db.sqlite` file.
process.env.JWT_SECRET = 'test-jwt-secret-do-not-use-in-prod';
process.env.REFRESH_SECRET = 'test-refresh-secret-do-not-use-in-prod';
process.env.SQLITE_FILE = ':memory:';
process.env.FRONTEND_URL = 'http://localhost:5173';
process.env.NODE_ENV = 'test';
process.env.ADMIN_EMAIL = 'admin@web3platform.com';
process.env.ADMIN_PASSWORD = 'test-admin-password-123';
