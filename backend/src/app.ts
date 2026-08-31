import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import swaggerUi from 'swagger-ui-express';
import { env } from './config/env';
import { swaggerSpec } from './config/swagger';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';
import { apiLimiter } from './middleware/rateLimit.middleware';

// .env is loaded via the `-r dotenv/config` preload flag (see package.json's
// dev/start scripts), NOT here — module imports are hoisted above any code
// in this file, so `import { env } from './config/env'` above would already
// have read process.env (and thrown, since env.ts fails fast on missing
// secrets) before a `dotenv.config()` call placed at this point ever ran.

const app = express();

// CSP is disabled: Swagger UI (mounted below, on this same app) needs
// inline styles/scripts to render, and this is a JSON API otherwise — every
// other helmet protection (frameguard, noSniff, referrer-policy, etc.)
// still applies.
app.use(helmet({ contentSecurityPolicy: false }));
app.use(apiLimiter);
app.use(cors({
  origin: env.frontendUrl,
  credentials: true, // Required for httpOnly cookies (access + refresh tokens)
}));
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());

import authRoutes from './routes/auth.routes';
import adminRoutes from './routes/admin.routes';
import tokenRoutes from './routes/token.routes';
import transactionRoutes from './routes/transaction.routes';
import notificationRoutes from './routes/notification.routes';

app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'Backend is running securely' });
});

app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/tokens', tokenRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/notifications', notificationRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
