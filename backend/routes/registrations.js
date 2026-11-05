/**
 * Registration Routes & Controller
 * StratosEvent - Event Management Platform
 * 
 * Features:
 * - Transactional capacity enforcement with SELECT ... FOR UPDATE
 * - Duplicate registration prevention
 * - Participant self-registration and cancellation
 * - Admin registration approval, rejection, and management
 */

const express = require('express');
const crypto = require('crypto');
const { pool } = require('../config/db');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { ALLOWED_REG_STATUSES, ALLOWED_TICKET_TIERS, validateTicketTier } = require('../middleware/validator');

const router = express.Router();

/**
 * Generate a cryptographically secure, unique booking ticket code.
 * Format: SE-<eventId>-<userId>-<timestamp36>-<hex4>
 */
function generateTicketCode(eventId, userId) {
  const timePart = Date.now().toString(36).toUpperCase();
  const randPart = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `SE-${eventId}-${userId}-${timePart}-${randPart}`;
}

/**
 * POST /api/registrations
 * Register the authenticated user for an event with strict capacity protection & race-condition prevention.
 */
router.post('/', authenticateToken, validateTicketTier, async (req, res, next) => {
  const eventId = parseInt(req.body.event_id, 10);
  if (isNaN(eventId)) {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_EVENT_ID', message: 'Valid event_id is required in request body.' },
    });
  }

  const userId = req.user.id;
  const ticketTier = req.body.ticket_tier;
  const conn = await pool.getConnection();

  try {
    // 1. Begin database transaction
    await conn.beginTransaction();

    // 2. Lock event row to read capacity, tier quotas, and status safely
    const [eventRows] = await conn.query(
      `SELECT id, title, capacity, capacity_general, capacity_vip, capacity_student, capacity_early_bird, status, start_time, end_time 
       FROM events 
       WHERE id = ? 
       FOR UPDATE`,
      [eventId]
    );

    if (eventRows.length === 0) {
      await conn.rollback();
      return res.status(404).json({
        success: false,
        error: { code: 'EVENT_NOT_FOUND', message: `Event with ID ${eventId} does not exist.` },
      });
    }

    const event = eventRows[0];

    // 3. Ensure event is published
    if (event.status !== 'published') {
      await conn.rollback();
      return res.status(400).json({
        success: false,
        error: {
          code: 'EVENT_NOT_OPEN',
          message: `Cannot register: Event is currently '${event.status}'. Only published events accept registrations.`,
        },
      });
    }

    // 4. Check if user already has a registration record for this event
    const [existingRegs] = await conn.query(
      `SELECT id, ticket_code, status 
       FROM registrations 
       WHERE user_id = ? AND event_id = ? 
       FOR UPDATE`,
      [userId, eventId]
    );

    if (existingRegs.length > 0) {
      const existing = existingRegs[0];
      if (existing.status !== 'cancelled') {
        await conn.rollback();
        return res.status(409).json({
          success: false,
          error: {
            code: 'DUPLICATE_REGISTRATION',
            message: 'You are already registered for this event.',
            ticket_code: existing.ticket_code,
            status: existing.status,
          },
        });
      }
    }

    // 5. Check per-tier quota limit and availability if defined for this event
    const tierColMap = {
      general: 'capacity_general',
      vip: 'capacity_vip',
      student: 'capacity_student',
      early_bird: 'capacity_early_bird',
    };
    const tierCol = tierColMap[ticketTier];
    const tierQuota = (tierCol && event[tierCol] !== null && event[tierCol] !== undefined) ? parseInt(event[tierCol], 10) : null;

    if (tierQuota !== null) {
      const tierLabel = ticketTier === 'early_bird' ? 'Early Bird' : (ticketTier.toUpperCase() === 'VIP' ? 'VIP' : ticketTier.charAt(0).toUpperCase() + ticketTier.slice(1));

      if (tierQuota <= 0) {
        await conn.rollback();
        return res.status(400).json({
          success: false,
          error: {
            code: 'TIER_NOT_AVAILABLE',
            message: `This event does not offer ${tierLabel} passes.`,
          },
        });
      }

      const [tierCountRows] = await conn.query(
        `SELECT COUNT(*) AS tier_count 
         FROM registrations 
         WHERE event_id = ? AND ticket_tier = ? AND status IN ('approved', 'pending') 
         FOR UPDATE`,
        [eventId, ticketTier]
      );

      const tierActiveCount = tierCountRows[0].tier_count;
      if (tierActiveCount >= tierQuota) {
        await conn.rollback();
        return res.status(409).json({
          success: false,
          error: {
            code: 'TIER_CAPACITY_REACHED',
            message: `${tierLabel} passes are sold out for this event.`,
            tier: ticketTier,
            tier_capacity: tierQuota,
            tier_registered: tierActiveCount,
          },
        });
      }
    }

    // 6. Check remaining total capacity (active registrations)
    const [countRows] = await conn.query(
      `SELECT COUNT(*) AS active_count 
       FROM registrations 
       WHERE event_id = ? AND status IN ('approved', 'pending') 
       FOR UPDATE`,
      [eventId]
    );

    const activeCount = countRows[0].active_count;
    if (activeCount >= event.capacity) {
      await conn.rollback();
      return res.status(409).json({
        success: false,
        error: {
          code: 'CAPACITY_REACHED',
          message: `Registration full. All ${event.capacity} seats have been reserved for this event.`,
          capacity: event.capacity,
          registered: activeCount,
        },
      });
    }

    // 7. Generate ticket code and register user
    const ticketCode = generateTicketCode(eventId, userId);
    let registrationId;

    if (existingRegs.length > 0 && existingRegs[0].status === 'cancelled') {
      // Re-activate previously cancelled registration with the requested tier
      registrationId = existingRegs[0].id;
      await conn.query(
        `UPDATE registrations 
         SET status = 'approved', ticket_code = ?, ticket_tier = ?, registration_date = CURRENT_TIMESTAMP 
         WHERE id = ?`,
        [ticketCode, ticketTier, registrationId]
      );
    } else {
      // Create fresh registration record with the requested tier
      const [insertResult] = await conn.query(
        `INSERT INTO registrations (user_id, event_id, ticket_code, ticket_tier, status) 
         VALUES (?, ?, ?, ?, 'approved')`,
        [userId, eventId, ticketCode, ticketTier]
      );
      registrationId = insertResult.insertId;
    }

    // 7. Commit transaction
    await conn.commit();

    return res.status(201).json({
      success: true,
      message: 'Registration confirmed successfully.',
      registration: {
        id: registrationId,
        user_id: userId,
        event_id: eventId,
        event_title: event.title,
        ticket_code: ticketCode,
        ticket_tier: ticketTier,
        status: 'approved',
        seat_number: activeCount + 1,
        capacity: event.capacity,
      },
    });
  } catch (error) {
    await conn.rollback();
    next(error);
  } finally {
    conn.release();
  }
});

/**
 * GET /api/registrations/my
 * List all registrations belonging to the authenticated participant.
 */
router.get('/my', authenticateToken, async (req, res, next) => {
  try {
    const query = `
      SELECT 
        r.id,
        r.event_id,
        r.ticket_code,
        r.ticket_tier,
        r.status,
        r.registration_date,
        e.title AS event_title,
        e.description AS event_description,
        e.event_type,
        e.start_time,
        e.end_time,
        e.venue,
        e.status AS event_status,
        a.id AS attendance_id,
        a.check_in_time,
        a.check_in_status
      FROM registrations r
      INNER JOIN events e ON r.event_id = e.id
      LEFT JOIN attendance a ON r.id = a.registration_id
      WHERE r.user_id = ?
      ORDER BY r.registration_date DESC
    `;

    const [rows] = await pool.query(query, [req.user.id]);

    return res.status(200).json({
      success: true,
      count: rows.length,
      registrations: rows,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/registrations/:id/cancel
 * Participant cancels their registration (or Admin can cancel on their behalf).
 */
router.patch('/:id/cancel', authenticateToken, async (req, res, next) => {
  try {
    const regId = parseInt(req.params.id, 10);
    if (isNaN(regId)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_ID', message: 'Registration ID must be an integer.' },
      });
    }

    const [rows] = await pool.query(
      'SELECT id, user_id, event_id, status FROM registrations WHERE id = ?',
      [regId]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'REGISTRATION_NOT_FOUND', message: `Registration with ID ${regId} was not found.` },
      });
    }

    const reg = rows[0];

    // Authorization: User must own the registration or be an admin
    if (reg.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'You cannot cancel someone else\'s registration.' },
      });
    }

    if (reg.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        error: { code: 'ALREADY_CANCELLED', message: 'This registration is already cancelled.' },
      });
    }

    await pool.query(
      "UPDATE registrations SET status = 'cancelled' WHERE id = ?",
      [regId]
    );

    return res.status(200).json({
      success: true,
      message: 'Registration cancelled successfully. Seat has been released.',
      registration_id: regId,
      status: 'cancelled',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/registrations
 * List all registrations system-wide or filter by event/status (Admin only).
 */
router.get('/', authenticateToken, requireRole('admin'), async (req, res, next) => {
  try {
    const { event_id, status, search, ticket_tier } = req.query;
    const conditions = [];
    const params = [];

    if (event_id) {
      conditions.push('r.event_id = ?');
      params.push(parseInt(event_id, 10));
    }

    if (status) {
      conditions.push('r.status = ?');
      params.push(status);
    }

    if (ticket_tier && ALLOWED_TICKET_TIERS.includes(ticket_tier)) {
      conditions.push('r.ticket_tier = ?');
      params.push(ticket_tier);
    }

    if (search) {
      conditions.push('(u.full_name LIKE ? OR u.email LIKE ? OR r.ticket_code LIKE ?)');
      const s = `%${search.trim()}%`;
      params.push(s, s, s);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const query = `
      SELECT 
        r.id,
        r.user_id,
        r.event_id,
        r.ticket_code,
        r.ticket_tier,
        r.status,
        r.registration_date,
        u.full_name AS participant_name,
        u.email AS participant_email,
        u.phone_number AS participant_phone,
        e.title AS event_title,
        e.start_time AS event_start_time,
        a.check_in_time,
        a.check_in_status
      FROM registrations r
      INNER JOIN users u ON r.user_id = u.id
      INNER JOIN events e ON r.event_id = e.id
      LEFT JOIN attendance a ON r.id = a.registration_id
      ${whereClause}
      ORDER BY r.registration_date DESC
    `;

    const [rows] = await pool.query(query, params);

    return res.status(200).json({
      success: true,
      count: rows.length,
      registrations: rows,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/registrations/:id/status
 * Admin approval or rejection of a registration pass (Admin only).
 */
router.patch('/:id/status', authenticateToken, requireRole('admin'), async (req, res, next) => {
  const regId = parseInt(req.params.id, 10);
  const { status } = req.body;

  if (isNaN(regId)) {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_ID', message: 'Registration ID must be an integer.' },
    });
  }

  if (!status || !ALLOWED_REG_STATUSES.includes(status)) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_STATUS',
        message: `Status must be one of: [${ALLOWED_REG_STATUSES.join(', ')}].`,
      },
    });
  }

  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const [regs] = await conn.query(
      `SELECT r.id, r.event_id, r.status, r.ticket_tier, e.capacity, e.capacity_general, e.capacity_vip, e.capacity_student, e.capacity_early_bird 
       FROM registrations r
       INNER JOIN events e ON r.event_id = e.id
       WHERE r.id = ?
       FOR UPDATE`,
      [regId]
    );

    if (regs.length === 0) {
      await conn.rollback();
      return res.status(404).json({
        success: false,
        error: { code: 'REGISTRATION_NOT_FOUND', message: `Registration with ID ${regId} was not found.` },
      });
    }

    const reg = regs[0];

    // If changing to 'approved' from another state, verify total and tier capacities
    if (status === 'approved' && reg.status !== 'approved') {
      const [countRows] = await conn.query(
        `SELECT COUNT(*) AS active_count 
         FROM registrations 
         WHERE event_id = ? AND status = 'approved' AND id != ?
         FOR UPDATE`,
        [reg.event_id, regId]
      );

      if (countRows[0].active_count >= reg.capacity) {
        await conn.rollback();
        return res.status(409).json({
          success: false,
          error: {
            code: 'CAPACITY_REACHED',
            message: `Cannot approve registration: Event has already reached maximum capacity (${reg.capacity}).`,
          },
        });
      }

      // Check tier-specific quota if defined
      const tierColMap = {
        general: 'capacity_general',
        vip: 'capacity_vip',
        student: 'capacity_student',
        early_bird: 'capacity_early_bird',
      };
      const tierCol = tierColMap[reg.ticket_tier];
      const tierQuota = (tierCol && reg[tierCol] !== null && reg[tierCol] !== undefined) ? parseInt(reg[tierCol], 10) : null;

      if (tierQuota !== null) {
        const [tierCountRows] = await conn.query(
          `SELECT COUNT(*) AS tier_count 
           FROM registrations 
           WHERE event_id = ? AND ticket_tier = ? AND status = 'approved' AND id != ?
           FOR UPDATE`,
          [reg.event_id, reg.ticket_tier, regId]
        );

        if (tierCountRows[0].tier_count >= tierQuota) {
          await conn.rollback();
          const tierLabel = reg.ticket_tier === 'early_bird' ? 'Early Bird' : (reg.ticket_tier.toUpperCase() === 'VIP' ? 'VIP' : reg.ticket_tier.charAt(0).toUpperCase() + reg.ticket_tier.slice(1));
          return res.status(409).json({
            success: false,
            error: {
              code: 'TIER_CAPACITY_REACHED',
              message: `Cannot approve registration: ${tierLabel} quota (${tierQuota}) is fully exhausted.`,
            },
          });
        }
      }
    }

    await conn.query(
      'UPDATE registrations SET status = ? WHERE id = ?',
      [status, regId]
    );

    await conn.commit();

    return res.status(200).json({
      success: true,
      message: `Registration status updated to '${status}'.`,
      registration_id: regId,
      status,
    });
  } catch (error) {
    await conn.rollback();
    next(error);
  } finally {
    conn.release();
  }
});

module.exports = router;
