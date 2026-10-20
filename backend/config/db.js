/**
 * Database Connection Pool Configuration
 * StratosEvent - TCS iON Industry Project
 *
 * Uses mysql2/promise for connection pooling and async/await query handling.
 * Credentials and configurations are loaded securely from environment variables.
 */

const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables if not already initialized
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'stratosevent_db',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  waitForConnections: true,
  connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT || '10', 10),
  queueLimit: 0,
});

/**
 * Tests database connectivity.
 * Transparently reports real status without faking connections.
 *
 * @returns {Promise<{connected: boolean, message: string}>}
 */
async function testConnection() {
  try {
    const connection = await pool.getConnection();
    connection.release();
    return {
      connected: true,
      message: 'Successfully established connection to MySQL database.',
    };
  } catch (error) {
    return {
      connected: false,
      message: `Database connection unavailable: ${error.message}`,
    };
  }
}

module.exports = {
  pool,
  testConnection,
};
