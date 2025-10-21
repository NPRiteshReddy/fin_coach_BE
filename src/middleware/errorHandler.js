/**
 * Global error handling middleware
 */
const errorHandler = (err, req, res, next) => {
  console.error('Error:', err);

  // Default error response
  const errorResponse = {
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
      timestamp: new Date().toISOString()
    }
  };

  // Prisma errors
  if (err.code && err.code.startsWith('P')) {
    switch (err.code) {
      case 'P2002':
        errorResponse.error.code = 'VALIDATION_ERROR';
        errorResponse.error.message = 'A record with this value already exists';
        return res.status(409).json(errorResponse);
      case 'P2025':
        errorResponse.error.code = 'NOT_FOUND';
        errorResponse.error.message = 'The requested record was not found';
        return res.status(404).json(errorResponse);
      default:
        errorResponse.error.message = 'Database error occurred';
        return res.status(500).json(errorResponse);
    }
  }

  // Validation errors
  if (err.name === 'ValidationError') {
    errorResponse.error.code = 'VALIDATION_ERROR';
    errorResponse.error.message = err.message;
    return res.status(400).json(errorResponse);
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    errorResponse.error.code = 'AUTH_TOKEN_INVALID';
    errorResponse.error.message = 'Invalid authentication token';
    return res.status(401).json(errorResponse);
  }

  // Custom application errors
  if (err.statusCode && err.code) {
    errorResponse.error.code = err.code;
    errorResponse.error.message = err.message;
    if (err.details) {
      errorResponse.error.details = err.details;
    }
    return res.status(err.statusCode).json(errorResponse);
  }

  // Default 500 error
  // Don't expose internal error details in production
  if (process.env.NODE_ENV === 'development') {
    errorResponse.error.details = {
      message: err.message,
      stack: err.stack
    };
  }

  return res.status(500).json(errorResponse);
};

/**
 * 404 handler for unknown routes
 */
const notFoundHandler = (req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.path} not found`,
      timestamp: new Date().toISOString()
    }
  });
};

module.exports = {
  errorHandler,
  notFoundHandler
};
