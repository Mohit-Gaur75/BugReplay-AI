import { errorResponse } from '../utils/response.js';
import { ZodError } from 'zod';

export function errorHandler(err, req, res, next) {
  // Check if response already sent
  if (res.headersSent) {
    return next(err);
  }

  // Handle Zod validation errors
  if (err instanceof ZodError) {
    const details = err.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));
    return errorResponse(res, 'Validation error', 'VALIDATION_ERROR', 400, details);
  }

  // Handle Payload Too Large
  if (err.type === 'entity.too.large') {
    return errorResponse(res, 'Payload exceeds 100KB limit', 'PAYLOAD_TOO_LARGE', 413);
  }

  // Handle Custom Application Errors
  const statusCode = err.statusCode || 500;
  const errorCode = err.code || 'INTERNAL_ERROR';
  const message = err.isOperational ? err.message : (process.env.NODE_ENV === 'production' ? 'An internal error occurred' : err.message);

  if (statusCode >= 500) {
    console.error('Unhandled Server Error:', err);
  }

  return errorResponse(res, message, errorCode, statusCode);
}
