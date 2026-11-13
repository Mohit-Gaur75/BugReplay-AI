/**
 * Standard API Response Format Utilities
 */

export function successResponse(res, data = {}, message = null, statusCode = 200) {
  const payload = {
    success: true,
    data,
  };
  if (message) {
    payload.message = message;
  }
  return res.status(statusCode).json(payload);
}

export function errorResponse(res, message, code = 'INTERNAL_ERROR', statusCode = 500, details = []) {
  return res.status(statusCode).json({
    success: false,
    error: {
      code,
      message,
      details,
    },
  });
}
