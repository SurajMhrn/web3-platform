import swaggerJsdoc from 'swagger-jsdoc';

/**
 * OpenAPI spec generated from `@openapi` JSDoc blocks above each route
 * definition in `src/routes/*.ts`. Served at `GET /api/docs`.
 */
export const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Web3 Platform API',
      version: '1.0.0',
      description:
        'REST API for the Web3 Platform (Phase 1): auth, wallet linking, token records, ' +
        'transaction history, notifications, and admin management. Authentication is ' +
        'cookie-based (httpOnly `accessToken` + `refreshToken`) — there is no bearer token ' +
        'to paste in here; log in via `/api/auth/login` from this same origin and the ' +
        'browser will attach the cookies automatically.',
    },
    servers: [{ url: '/api', description: 'Relative to wherever this server is hosted' }],
    components: {
      schemas: {
        Error: {
          type: 'object',
          properties: { error: { type: 'string' } },
        },
      },
      securitySchemes: {
        cookieAuth: {
          type: 'apiKey',
          in: 'cookie',
          name: 'accessToken',
          description: 'httpOnly cookie set by /auth/login, /auth/register, or /auth/refresh.',
        },
      },
    },
  },
  apis: ['./src/routes/*.ts'],
});
