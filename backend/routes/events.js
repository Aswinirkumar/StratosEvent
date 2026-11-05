/**
 * Event Management Routes & Controller
 * StratosEvent - Event Management Platform
 */

const express = require('express');
const { pool } = require('../config/db');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { validateEvent, ALLOWED_EVENT_STATUSES } = require('../middleware/validator');

const router = express.Router();

/**
 * Optional token extraction to determine if caller is admin or public.
 */
function optionalAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return next();
  }
  const parts = authHeader.split(' ');
  if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') {
    try {
      const jwt = require('jsonwebtoken');
      const { JWT_SECRET } = require('../middleware/auth');
      req.user = jwt.verify(parts[1], JWT_SECRET, { algorithms: ['HS256'] });
    } catch {
      // Ignore token verification errors for optional auth
    }
  }
  next();
}

/**
 * GET /api/events
 * List all events with active registration counts, availability, and filtering.
 */
router.get('/', optionalAuth, async (req, res, next) => {
  try {
    const { status, event_type, search } = req.query;
    const conditions = [];
    const params = [];

    // Public / participant users only see published events by default
    const isAdmin = req.user && req.user.role === 'admin';
    if (status) {
      conditions.push('e.status = ?');
      params.push(status);
    } else if (!isAdmin) {
      conditions.push("e.status = 'published'");
    }

    if (event_type) {
      conditions.push('e.event_type = ?');
      params.push(event_type);
    }

    if (search) {
      conditions.push('(e.title LIKE ? OR e.description LIKE ?)');
      const searchParam = `%${search.trim()}%`;
      params.push(searchParam, searchParam);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const query = `
      SELECT 
        e.id,
        e.title,
        e.description,
        e.event_type,
        e.start_time,
        e.end_time,
        e.venue,
        e.capacity,
        e.capacity_general,
        e.capacity_vip,
        e.capacity_student,
        e.capacity_early_bird,
        e.status,
        e.created_by,
        e.created_at,
        e.updated_at,
        u.full_name AS creator_name,
        COALESCE(COUNT(CASE WHEN r.status IN ('approved', 'pending') THEN 1 END), 0) AS registered_count,
        GREATEST(0, e.capacity - COALESCE(COUNT(CASE WHEN r.status IN ('approved', 'pending') THEN 1 END), 0)) AS available_seats,
        COALESCE(COUNT(CASE WHEN r.ticket_tier = 'general' AND r.status IN ('approved', 'pending') THEN 1 END), 0) AS reg_general,
        COALESCE(COUNT(CASE WHEN r.ticket_tier = 'vip' AND r.status IN ('approved', 'pending') THEN 1 END), 0) AS reg_vip,
        COALESCE(COUNT(CASE WHEN r.ticket_tier = 'student' AND r.status IN ('approved', 'pending') THEN 1 END), 0) AS reg_student,
        COALESCE(COUNT(CASE WHEN r.ticket_tier = 'early_bird' AND r.status IN ('approved', 'pending') THEN 1 END), 0) AS reg_early_bird
      FROM events e
      LEFT JOIN users u ON e.created_by = u.id
      LEFT JOIN registrations r ON e.id = r.event_id
      ${whereClause}
      GROUP BY e.id
      ORDER BY e.start_time ASC
    `;

    const [rows] = await pool.query(query, params);

    const formattedEvents = rows.map((event) => ({
      ...event,
      capacity: Number(event.capacity),
      registered_count: Number(event.registered_count),
      available_seats: Number(event.available_seats),
      tier_capacities: {
        general: event.capacity_general !== null ? Number(event.capacity_general) : null,
        vip: event.capacity_vip !== null ? Number(event.capacity_vip) : null,
        student: event.capacity_student !== null ? Number(event.capacity_student) : null,
        early_bird: event.capacity_early_bird !== null ? Number(event.capacity_early_bird) : null,
      },
      tier_registered: {
        general: Number(event.reg_general || 0),
        vip: Number(event.reg_vip || 0),
        student: Number(event.reg_student || 0),
        early_bird: Number(event.reg_early_bird || 0),
      },
      tier_available: {
        general: event.capacity_general !== null ? Math.max(0, Number(event.capacity_general) - Number(event.reg_general || 0)) : null,
        vip: event.capacity_vip !== null ? Math.max(0, Number(event.capacity_vip) - Number(event.reg_vip || 0)) : null,
        student: event.capacity_student !== null ? Math.max(0, Number(event.capacity_student) - Number(event.reg_student || 0)) : null,
        early_bird: event.capacity_early_bird !== null ? Math.max(0, Number(event.capacity_early_bird) - Number(event.reg_early_bird || 0)) : null,
      },
    }));

    return res.status(200).json({
      success: true,
      count: formattedEvents.length,
      events: formattedEvents,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/events/:id
 * Retrieve a single event by ID with registration statistics.
 */
router.get('/:id', optionalAuth, async (req, res, next) => {
  try {
    const eventId = parseInt(req.params.id, 10);
    if (isNaN(eventId)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_ID', message: 'Event ID must be an integer.' },
      });
    }

    const query = `
      SELECT 
        e.id,
        e.title,
        e.description,
        e.event_type,
        e.start_time,
        e.end_time,
        e.venue,
        e.capacity,
        e.capacity_general,
        e.capacity_vip,
        e.capacity_student,
        e.capacity_early_bird,
        e.status,
        e.created_by,
        e.created_at,
        e.updated_at,
        u.full_name AS creator_name,
        COALESCE(COUNT(CASE WHEN r.status IN ('approved', 'pending') THEN 1 END), 0) AS registered_count,
        GREATEST(0, e.capacity - COALESCE(COUNT(CASE WHEN r.status IN ('approved', 'pending') THEN 1 END), 0)) AS available_seats,
        COALESCE(COUNT(CASE WHEN r.ticket_tier = 'general' AND r.status IN ('approved', 'pending') THEN 1 END), 0) AS reg_general,
        COALESCE(COUNT(CASE WHEN r.ticket_tier = 'vip' AND r.status IN ('approved', 'pending') THEN 1 END), 0) AS reg_vip,
        COALESCE(COUNT(CASE WHEN r.ticket_tier = 'student' AND r.status IN ('approved', 'pending') THEN 1 END), 0) AS reg_student,
        COALESCE(COUNT(CASE WHEN r.ticket_tier = 'early_bird' AND r.status IN ('approved', 'pending') THEN 1 END), 0) AS reg_early_bird
      FROM events e
      LEFT JOIN users u ON e.created_by = u.id
      LEFT JOIN registrations r ON e.id = r.event_id
      WHERE e.id = ?
      GROUP BY e.id
      LIMIT 1
    `;

    const [rows] = await pool.query(query, [eventId]);

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'EVENT_NOT_FOUND', message: `Event with ID ${eventId} was not found.` },
      });
    }

    const event = rows[0];
    const formattedEvent = {
      ...event,
      capacity: Number(event.capacity),
      registered_count: Number(event.registered_count),
      available_seats: Number(event.available_seats),
      tier_capacities: {
        general: event.capacity_general !== null ? Number(event.capacity_general) : null,
        vip: event.capacity_vip !== null ? Number(event.capacity_vip) : null,
        student: event.capacity_student !== null ? Number(event.capacity_student) : null,
        early_bird: event.capacity_early_bird !== null ? Number(event.capacity_early_bird) : null,
      },
      tier_registered: {
        general: Number(event.reg_general || 0),
        vip: Number(event.reg_vip || 0),
        student: Number(event.reg_student || 0),
        early_bird: Number(event.reg_early_bird || 0),
      },
      tier_available: {
        general: event.capacity_general !== null ? Math.max(0, Number(event.capacity_general) - Number(event.reg_general || 0)) : null,
        vip: event.capacity_vip !== null ? Math.max(0, Number(event.capacity_vip) - Number(event.reg_vip || 0)) : null,
        student: event.capacity_student !== null ? Math.max(0, Number(event.capacity_student) - Number(event.reg_student || 0)) : null,
        early_bird: event.capacity_early_bird !== null ? Math.max(0, Number(event.capacity_early_bird) - Number(event.reg_early_bird || 0)) : null,
      },
    };

    return res.status(200).json({
      success: true,
      event: formattedEvent,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/events
 * Create a new event (Admin only).
 */
router.post(
  '/',
  authenticateToken,
  requireRole('admin'),
  validateEvent(false),
  async (req, res, next) => {
    try {
      const {
        title,
        description,
        event_type,
        start_time,
        end_time,
        venue,
        capacity,
        capacity_general = null,
        capacity_vip = null,
        capacity_student = null,
        capacity_early_bird = null,
        status = 'published',
      } = req.body;

      const [result] = await pool.query(
        `INSERT INTO events 
         (title, description, event_type, start_time, end_time, venue, capacity, capacity_general, capacity_vip, capacity_student, capacity_early_bird, status, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          title.trim(),
          description ? description.trim() : null,
          event_type,
          new Date(start_time),
          new Date(end_time),
          venue.trim(),
          parseInt(capacity, 10),
          capacity_general !== null ? parseInt(capacity_general, 10) : null,
          capacity_vip !== null ? parseInt(capacity_vip, 10) : null,
          capacity_student !== null ? parseInt(capacity_student, 10) : null,
          capacity_early_bird !== null ? parseInt(capacity_early_bird, 10) : null,
          status,
          req.user.id,
        ]
      );

      const [createdRows] = await pool.query(
        'SELECT * FROM events WHERE id = ?',
        [result.insertId]
      );

      return res.status(201).json({
        success: true,
        message: 'Event created successfully.',
        event: createdRows[0],
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /api/events/:id
 * Update an existing event (Admin only).
 */
router.put(
  '/:id',
  authenticateToken,
  requireRole('admin'),
  validateEvent(true),
  async (req, res, next) => {
    try {
      const eventId = parseInt(req.params.id, 10);
      if (isNaN(eventId)) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_ID', message: 'Event ID must be an integer.' },
        });
      }

      // Check existence
      const [existing] = await pool.query('SELECT * FROM events WHERE id = ?', [eventId]);
      if (existing.length === 0) {
        return res.status(404).json({
          success: false,
          error: { code: 'EVENT_NOT_FOUND', message: `Event with ID ${eventId} was not found.` },
        });
      }

      const current = existing[0];
      const updatedTitle = req.body.title !== undefined ? req.body.title.trim() : current.title;
      const updatedDesc = req.body.description !== undefined ? req.body.description.trim() : current.description;
      const updatedType = req.body.event_type || current.event_type;
      const updatedStart = req.body.start_time ? new Date(req.body.start_time) : current.start_time;
      const updatedEnd = req.body.end_time ? new Date(req.body.end_time) : current.end_time;
      const updatedVenue = req.body.venue !== undefined ? req.body.venue.trim() : current.venue;
      const updatedCapacity = req.body.capacity !== undefined ? parseInt(req.body.capacity, 10) : current.capacity;
      const updatedCapGeneral = req.body.capacity_general !== undefined ? (req.body.capacity_general !== null ? parseInt(req.body.capacity_general, 10) : null) : current.capacity_general;
      const updatedCapVip = req.body.capacity_vip !== undefined ? (req.body.capacity_vip !== null ? parseInt(req.body.capacity_vip, 10) : null) : current.capacity_vip;
      const updatedCapStudent = req.body.capacity_student !== undefined ? (req.body.capacity_student !== null ? parseInt(req.body.capacity_student, 10) : null) : current.capacity_student;
      const updatedCapEarlyBird = req.body.capacity_early_bird !== undefined ? (req.body.capacity_early_bird !== null ? parseInt(req.body.capacity_early_bird, 10) : null) : current.capacity_early_bird;
      const updatedStatus = req.body.status || current.status;

      await pool.query(
        `UPDATE events 
         SET title = ?, description = ?, event_type = ?, start_time = ?, end_time = ?, venue = ?, capacity = ?, capacity_general = ?, capacity_vip = ?, capacity_student = ?, capacity_early_bird = ?, status = ?
         WHERE id = ?`,
        [
          updatedTitle,
          updatedDesc,
          updatedType,
          updatedStart,
          updatedEnd,
          updatedVenue,
          updatedCapacity,
          updatedCapGeneral,
          updatedCapVip,
          updatedCapStudent,
          updatedCapEarlyBird,
          updatedStatus,
          eventId,
        ]
      );

      const [updatedRows] = await pool.query('SELECT * FROM events WHERE id = ?', [eventId]);

      return res.status(200).json({
        success: true,
        message: 'Event updated successfully.',
        event: updatedRows[0],
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PATCH /api/events/:id/status
 * Archive or change event lifecycle status (Admin only).
 */
router.patch(
  '/:id/status',
  authenticateToken,
  requireRole('admin'),
  async (req, res, next) => {
    try {
      const eventId = parseInt(req.params.id, 10);
      const { status } = req.body;

      if (!status || !ALLOWED_EVENT_STATUSES.includes(status)) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_STATUS',
            message: `Status must be one of: [${ALLOWED_EVENT_STATUSES.join(', ')}].`,
          },
        });
      }

      const [result] = await pool.query(
        'UPDATE events SET status = ? WHERE id = ?',
        [status, eventId]
      );

      if (result.matchedRows === 0) {
        return res.status(404).json({
          success: false,
          error: { code: 'EVENT_NOT_FOUND', message: `Event with ID ${eventId} was not found.` },
        });
      }

      return res.status(200).json({
        success: true,
        message: `Event status updated to '${status}' successfully.`,
        eventId,
        status,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/events/:id
 * Delete an event or archive it if registrations exist (Admin only).
 */
router.delete(
  '/:id',
  authenticateToken,
  requireRole('admin'),
  async (req, res, next) => {
    try {
      const eventId = parseInt(req.params.id, 10);

      // Check if event exists
      const [existing] = await pool.query('SELECT * FROM events WHERE id = ?', [eventId]);
      if (existing.length === 0) {
        return res.status(404).json({
          success: false,
          error: { code: 'EVENT_NOT_FOUND', message: `Event with ID ${eventId} was not found.` },
        });
      }

      // Check active registrations
      const [regs] = await pool.query(
        'SELECT COUNT(*) AS total FROM registrations WHERE event_id = ?',
        [eventId]
      );

      if (regs[0].total > 0 && req.query.force !== 'true') {
        // Safe archiving instead of hard delete when active registrations exist
        await pool.query("UPDATE events SET status = 'cancelled' WHERE id = ?", [eventId]);
        return res.status(200).json({
          success: true,
          message: 'Event contains registered participants and was safely archived with status "cancelled". Use ?force=true to hard delete.',
          action: 'archived',
        });
      }

      await pool.query('DELETE FROM events WHERE id = ?', [eventId]);

      return res.status(200).json({
        success: true,
        message: 'Event deleted successfully.',
        action: 'deleted',
      });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
