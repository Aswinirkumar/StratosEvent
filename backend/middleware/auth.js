/**
 * Authentication and Role-Based Authorization Middleware
 * StratosEvent - Event Management Platform
 */

const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'stratosevent_jwt_secret_dev_2026_secure_key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

// Production configuration audit: require dedicated strong secret in production
if (process.env.NODE_ENV === 'production') {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'stratosevent_jwt_secret_dev_2026_secure_key') {
    throw new Error('[Security Exception] A dedicated, strong JWT_SECRET environment variable is mandatory in production.');
  }
}

/**
 * Generate a JWT token for an authenticated user.
 *
 * @param {Object} user - User payload { id, email, role, full_name }
 * @returns {string} - Signed JWT token
 */
function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      full_name: user.full_name,
    },
    JWT_SECRET,
    { algorithm: 'HS256', expiresIn: JWT_EXPIRES_IN }
  );
}

/**
 * Middleware to authenticate requests via Bearer JWT token.
 */
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'AUTH_TOKEN_REQUIRED',
        message: 'Access denied. No authorization token was provided.',
      },
    });
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
    return res.status(401).json({
      success: false,
      error: {
        code: 'AUTH_TOKEN_MALFORMED',
        message: 'Invalid authorization format. Expected: Bearer <token>',
      },
    });
  }

  const token = parts[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
    req.user = decoded;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: {
          code: 'TOKEN_EXPIRED',
          message: 'Your session token has expired. Please log in again.',
        },
      });
    }

    return res.status(401).json({
      success: false,
      error: {
        code: 'INVALID_TOKEN',
        message: 'Failed to authenticate token. Invalid signature.',
      },
    });
  }
}

/**
 * Middleware to enforce role-based access control (RBAC).
 *
 * @param  {...string} allowedRoles - List of allowed roles (e.g. 'admin', 'participant')
 */
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required before checking permissions.',
        },
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: `Access denied. Requires one of the following roles: [${allowedRoles.join(', ')}]. Your role is '${req.user.role}'.`,
        },
      });
    }

    next();
  };
}

module.exports = {
  JWT_SECRET,
  generateToken,
  authenticateToken,
  requireRole,
};
