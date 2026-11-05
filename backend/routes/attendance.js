/**
 * Attendance Check-In Routes & Controller
 * StratosEvent - Event Management Platform
 * 
 * Features:
 * - Admin/Staff ticket verification and check-in
 * - Strict duplicate check-in prevention
 * - Event attendance roster and statistics
 */

const express = require('express');
const { pool } = require('../config/db');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { ALLOWED_ATTENDANCE_STATUSES } = require('../middleware/validator');

const router = express.Router();

/**
 * POST /api/attendance/check-in
 * Record attendee check-in via ticket code or registration ID (Admin only).
 * Strictly prevents duplicate entry.
 */
router.post('/check-in', authenticateToken, requireRole('admin'), async (req, res, next) => {
  try {
    const { ticket_code, registration_id, check_in_status = 'checked_in', notes } = req.body;

    if (!ticket_code && !registration_id) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'IDENTIFIER_REQUIRED',
          message: 'Either ticket_code or registration_id must be provided for check-in.',
        },
      });
    }

    if (check_in_status && !ALLOWED_ATTENDANCE_STATUSES.includes(check_in_status)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_STATUS',
          message: `check_in_status must be one of: [${ALLOWED_ATTENDANCE_STATUSES.join(', ')}].`,
        },
      });
    }

    // 1. Find the registration and participant details
    const findQuery = `
      SELECT 
        r.id AS registration_id,
        r.user_id,
        r.event_id,
        r.ticket_code,
        r.ticket_tier,
        r.status AS registration_status,
        u.full_name AS participant_name,
        u.email AS participant_email,
        e.title AS event_title
      FROM registrations r
      INNER JOIN users u ON r.user_id = u.id
      INNER JOIN events e ON r.event_id = e.id
      WHERE ${ticket_code ? 'r.ticket_code = ?' : 'r.id = ?'}
      LIMIT 1
    `;

    const identifier = ticket_code ? ticket_code.trim() : parseInt(registration_id, 10);
    const [regRows] = await pool.query(findQuery, [identifier]);

    if (regRows.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'TICKET_NOT_FOUND',
          message: 'No registration was found for the provided ticket code or ID.',
        },
      });
    }

    const reg = regRows[0];

    // 2. Ensure ticket is approved
    if (reg.registration_status !== 'approved') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'REGISTRATION_NOT_APPROVED',
          message: `Cannot check in: Registration status is '${reg.registration_status}'. Only approved tickets are eligible for entry.`,
        },
      });
    }

    // 3. Check for existing attendance record (Duplicate Check-in Prevention)
    const [existingAttendance] = await pool.query(
      `SELECT a.id, a.check_in_time, a.check_in_status, u.full_name AS verifier_name
       FROM attendance a
       LEFT JOIN users u ON a.verified_by = u.id
       WHERE a.registration_id = ?
       LIMIT 1`,
      [reg.registration_id]
    );

    if (existingAttendance.length > 0) {
      const existing = existingAttendance[0];
      return res.status(409).json({
        success: false,
        error: {
          code: 'DUPLICATE_CHECKIN',
          message: `Duplicate check-in prevented. Attendee '${reg.participant_name}' was already checked in at ${existing.check_in_time}.`,
          check_in_time: existing.check_in_time,
          check_in_status: existing.check_in_status,
          verified_by: existing.verifier_name || 'Admin',
        },
      });
    }

    // 4. Record new attendance check-in
    const [insertResult] = await pool.query(
      `INSERT INTO attendance (registration_id, check_in_status, verified_by, notes)
       VALUES (?, ?, ?, ?)`,
      [
        reg.registration_id,
        check_in_status,
        req.user.id,
        notes ? notes.trim() : null,
      ]
    );

    return res.status(201).json({
      success: true,
      message: 'Check-in verified and recorded successfully.',
      attendance: {
        id: insertResult.insertId,
        registration_id: reg.registration_id,
        ticket_code: reg.ticket_code,
        participant_name: reg.participant_name,
        participant_email: reg.participant_email,
        event_title: reg.event_title,
        check_in_status,
        check_in_time: new Date().toISOString(),
        verified_by: req.user.full_name,
      },
    });
  } catch (error) {
    // Handle MySQL unique constraint violation gracefully if race condition occurs
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        success: false,
        error: {
          code: 'DUPLICATE_CHECKIN',
          message: 'Duplicate check-in prevented: This registration has already been checked in.',
        },
      });
    }
    next(error);
  }
});

/**
 * GET /api/attendance/verify/:ticketCode
 * Pre-check ticket status without marking attendance (Admin only).
 */
router.get('/verify/:ticketCode', authenticateToken, requireRole('admin'), async (req, res, next) => {
  try {
    const { ticketCode } = req.params;

    const query = `
      SELECT 
        r.id AS registration_id,
        r.ticket_code,
        r.ticket_tier,
        r.status AS registration_status,
        r.registration_date,
        u.full_name AS participant_name,
        u.email AS participant_email,
        e.id AS event_id,
        e.title AS event_title,
        e.start_time AS event_start_time,
        a.id AS attendance_id,
        a.check_in_time,
        a.check_in_status
      FROM registrations r
      INNER JOIN users u ON r.user_id = u.id
      INNER JOIN events e ON r.event_id = e.id
      LEFT JOIN attendance a ON r.id = a.registration_id
      WHERE r.ticket_code = ?
      LIMIT 1
    `;

    const [rows] = await pool.query(query, [ticketCode.trim()]);

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'TICKET_NOT_FOUND', message: 'Ticket code does not match any known registration.' },
      });
    }

    const item = rows[0];
    const isAlreadyCheckedIn = Boolean(item.attendance_id);

    return res.status(200).json({
      success: true,
      ticket: {
        registration_id: item.registration_id,
        ticket_code: item.ticket_code,
        ticket_tier: item.ticket_tier,
        registration_status: item.registration_status,
        participant_name: item.participant_name,
        participant_email: item.participant_email,
        event_id: item.event_id,
        event_title: item.event_title,
        event_start_time: item.event_start_time,
        is_already_checked_in: isAlreadyCheckedIn,
        check_in_time: item.check_in_time,
        check_in_status: item.check_in_status,
        can_check_in: item.registration_status === 'approved' && !isAlreadyCheckedIn,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/attendance/event/:eventId
 * Retrieve attendee check-in roster and attendance rate metrics for an event (Admin only).
 */
router.get('/event/:eventId', authenticateToken, requireRole('admin'), async (req, res, next) => {
  try {
    const eventId = parseInt(req.params.eventId, 10);
    if (isNaN(eventId)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_ID', message: 'Event ID must be an integer.' },
      });
    }

    // Check event
    const [events] = await pool.query('SELECT id, title, capacity FROM events WHERE id = ?', [eventId]);
    if (events.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'EVENT_NOT_FOUND', message: `Event with ID ${eventId} was not found.` },
      });
    }

    const event = events[0];

    const rosterQuery = `
      SELECT 
        r.id AS registration_id,
        r.ticket_code,
        r.ticket_tier,
        r.status AS registration_status,
        u.full_name AS participant_name,
        u.email AS participant_email,
        u.phone_number AS participant_phone,
        a.id AS attendance_id,
        a.check_in_time,
        a.check_in_status,
        a.notes,
        v.full_name AS verified_by_name
      FROM registrations r
      INNER JOIN users u ON r.user_id = u.id
      LEFT JOIN attendance a ON r.id = a.registration_id
      LEFT JOIN users v ON a.verified_by = v.id
      WHERE r.event_id = ?
      ORDER BY u.full_name ASC
    `;

    const [roster] = await pool.query(rosterQuery, [eventId]);

    const totalApproved = roster.filter(r => r.registration_status === 'approved').length;
    const totalCheckedIn = roster.filter(r => Boolean(r.attendance_id)).length;
    const attendancePercentage = totalApproved > 0 ? ((totalCheckedIn / totalApproved) * 100).toFixed(1) + '%' : '0%';

    return res.status(200).json({
      success: true,
      event: {
        id: event.id,
        title: event.title,
        capacity: event.capacity,
      },
      metrics: {
        total_registered: roster.length,
        total_approved: totalApproved,
        total_checked_in: totalCheckedIn,
        attendance_percentage: attendancePercentage,
      },
      roster,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
