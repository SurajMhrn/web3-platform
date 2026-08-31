/**
 * A known, expected error with an HTTP status code attached. Thrown from
 * controllers/models for client-facing failures (bad input, not found,
 * conflict, etc.) and translated 1:1 into a JSON response by the central
 * error handler. Anything else (a genuine bug or infra failure) falls
 * through as a generic 500 without leaking internals.
 */
export class AppError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
    this.name = 'AppError';
  }
}
