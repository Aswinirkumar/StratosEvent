/**
 * Authentication Routes & Controller
 * StratosEvent - Event Management Platform
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const { pool } = require('../config/db');
const { generateToken, authenticateToken } = require('../middleware/auth');
const { validateRegister, validateLogin } = require('../middleware/validator');

const router = express.Router();

/**
 * POST /api/auth/register
 * Register a new user (defaults to participant role).
 */
router.post('/register', validateRegister, async (req, res, next) => {
  try {
    const { full_name, email, password, phone_number } = req.body;
    // Security: Public registration MUST strictly assign the 'participant' role.
    // Any role supplied in the request body is intentionally ignored to prevent privilege escalation.
    const assignedRole = 'participant';

    // Check if email already exists
    const [existingUsers] = await pool.query(
      'SELECT id FROM users WHERE email = ? LIMIT 1',
      [email]
    );

    if (existingUsers.length > 0) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'EMAIL_ALREADY_EXISTS',
          message: 'An account with this email address already exists.',
        },
      });
    }

    // Secure bcrypt hashing
    const saltRounds = 10;
    const password_hash = await bcrypt.hash(password, saltRounds);

    // Insert user into database
    const [result] = await pool.query(
      `INSERT INTO users (full_name, email, password_hash, role, phone_number)
       VALUES (?, ?, ?, ?, ?)`,
      [full_name, email, password_hash, assignedRole, phone_number || null]
    );

    const newUser = {
      id: result.insertId,
      full_name,
      email,
      role: assignedRole,
      phone_number: phone_number || null,
    };

    const token = generateToken(newUser);

    return res.status(201).json({
      success: true,
      message: 'User registered successfully.',
      token,
      user: newUser,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/auth/login
 * Authenticate user with email and password, returning a JWT token.
 */
router.post('/login', validateLogin, async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Fetch user with hashed password
    const [rows] = await pool.query(
      `SELECT id, full_name, email, password_hash, role, phone_number 
       FROM users 
       WHERE email = ? 
       LIMIT 1`,
      [email]
    );

    if (rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password.',
        },
      });
    }

    const user = rows[0];

    // Verify password hash
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password.',
        },
      });
    }

    const userPayload = {
      id: user.id,
      full_name: user.full_name,
      email: user.email,
      role: user.role,
      phone_number: user.phone_number,
    };

    const token = generateToken(userPayload);

    return res.status(200).json({
      success: true,
      message: 'Login successful.',
      token,
      user: userPayload,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/auth/me
 * Retrieve profile information for the authenticated user.
 */
router.get('/me', authenticateToken, async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, full_name, email, role, phone_number, created_at, updated_at 
       FROM users 
       WHERE id = ? 
       LIMIT 1`,
      [req.user.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User profile not found.',
        },
      });
    }

    return res.status(200).json({
      success: true,
      user: rows[0],
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
