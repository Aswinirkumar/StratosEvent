/**
 * StratosEvent — Application Entry Point
 * Express Server & REST API
 * TCS iON Industry Project
 */

const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { testConnection } = require('./config/db');

// Route modules
const authRoutes = require('./routes/auth');
const eventRoutes = require('./routes/events');
const registrationRoutes = require('./routes/registrations');
const attendanceRoutes = require('./routes/attendance');
const analyticsRoutes = require('./routes/analytics');

// Load environment variables from .env file
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// ---------------------------------------------------------------------
// 1. Core Middleware
// ---------------------------------------------------------------------
// Enable Cross-Origin Resource Sharing (CORS) for frontend requests
app.use(cors());

// Parse incoming JSON payloads
app.use(express.json());

// Parse incoming URL-encoded form data
app.use(express.urlencoded({ extended: true }));

// Simple logger middleware for incoming HTTP requests (useful for beginners)
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.originalUrl}`);
  next();
});

// ---------------------------------------------------------------------
// 2. Base & Health-Check Endpoints
// ---------------------------------------------------------------------

/**
 * Root Info Endpoint
 * GET /
 */
app.get('/', (req, res) => {
  res.json({
    project: 'StratosEvent — Event Management and Registration Platform',
    organization: 'TCS iON Industry Project',
    status: 'Running',
    version: '1.0.0',
    documentation: '/docs/README.md',
    healthCheck: '/api/health',
  });
});

/**
 * Health-Check Endpoint
 * GET /api/health
 *
 * Checks server status and accurately tests MySQL connectivity.
 * Transparently indicates whether database is connected or disconnected.
 */
app.get('/api/health', async (req, res) => {
  const dbHealth = await testConnection();

  res.status(200).json({
    status: 'UP',
    service: 'StratosEvent Backend API',
    environment: NODE_ENV,
    timestamp: new Date().toISOString(),
    database: {
      status: dbHealth.connected ? 'connected' : 'disconnected',
      detail: dbHealth.message,
    },
  });
});

// ---------------------------------------------------------------------
// 3. Application REST API Endpoints
// ---------------------------------------------------------------------
app.use('/api/auth', authRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/registrations', registrationRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/analytics', analyticsRoutes);

// ---------------------------------------------------------------------
// 4. 404 Route Handler (Catch-all for undefined routes)
// ---------------------------------------------------------------------
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'ROUTE_NOT_FOUND',
      message: `The requested endpoint ${req.method} ${req.originalUrl} does not exist.`,
    },
  });
});

// ---------------------------------------------------------------------
// 4. Centralized Error-Handling Middleware
// ---------------------------------------------------------------------
app.use((err, req, res, next) => {
  console.error('[Error] Internal Server Error:', err.stack || err.message);

  res.status(err.status || 500).json({
    success: false,
    error: {
      code: err.code || 'INTERNAL_SERVER_ERROR',
      message: err.message || 'An unexpected error occurred on the server.',
      ...(NODE_ENV === 'development' && { stack: err.stack }),
    },
  });
});

// ---------------------------------------------------------------------
// 5. Start Server
// ---------------------------------------------------------------------
app.listen(PORT, async () => {
  console.log('=====================================================');
  console.log(`🚀 StratosEvent Server running on port ${PORT}`);
  console.log(`🌐 Base URL: http://localhost:${PORT}`);
  console.log(`🩺 Health Check: http://localhost:${PORT}/api/health`);
  console.log(`⚙️  Environment: ${NODE_ENV}`);
  console.log('=====================================================');

  // Asynchronously test and log database connection on startup
  const dbCheck = await testConnection();
  if (dbCheck.connected) {
    console.log('✅ [Database] MySQL connection established.');
  } else {
    console.log(`⚠️  [Database] Notice: ${dbCheck.message}`);
    console.log('ℹ️  Ensure MySQL is running and .env credentials are set if database features are needed.');
  }
});

module.exports = app;
