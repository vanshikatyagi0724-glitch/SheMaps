// Custom HTTP Error Class and Central Error Middleware

export class HttpError extends Error {
  constructor(statusCode, message, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
  }
}

// 404 handler for undefined routes
export function notFoundHandler(req, res) {
  res.status(404).json({
    error: `Route not found: ${req.method} ${req.originalUrl}`,
  });
}

// Central error handling middleware
export function errorHandler(err, req, res, next) {
  // Malformed JSON syntax in request body
  if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
    return res.status(400).json({
      error: "Malformed JSON in request body",
    });
  }

  // Request payload too large (over 100kb)
  if (err.type === "entity.too.large" || err.status === 413) {
    return res.status(413).json({
      error: "Request body exceeds 100kb limit",
    });
  }

  // Explicit operational HttpError
  if (err instanceof HttpError) {
    const response = { error: err.message };
    if (err.details) {
      response.details = err.details;
    }
    return res.status(err.statusCode).json(response);
  }

  // SQLite Constraint violations
  if (err.code === "SQLITE_CONSTRAINT_CHECK") {
    return res.status(400).json({
      error: "Database constraint violated",
    });
  }

  // Generic 500 - Never leaks stack traces
  console.error("Internal Server Error:", err.message);
  return res.status(500).json({
    error: "Internal server error",
  });
}
