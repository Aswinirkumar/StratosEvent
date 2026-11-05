/**
 * Analytics and Reporting Routes & Controller
 * StratosEvent — Enterprise Event Management Platform
 * 
 * Provides real-time aggregated metrics, attendance confirmation ratios,
 * event-wise capacity utilization, collected participant demographics,
 * and authorized CSV roster exports.
 */

const express = require('express');
const { pool } = require('../config/db');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// Enforce admin-only access on all analytics routes
router.use(authenticateToken, requireRole('admin'));

/**
 * GET /api/analytics/overview
 * System-wide business intelligence overview.
 */
router.get('/overview', async (req, res, next) => {
  try {
    // 1. Event Status Breakdown
    const [eventStatusRows] = await pool.query(`
      SELECT 
        status, 
        COUNT(*) AS count 
      FROM events 
      GROUP BY status
    `);

    const eventCounts = {
      total: 0,
      published: 0,
      draft: 0,
      completed: 0,
      cancelled: 0,
    };
    eventStatusRows.forEach((row) => {
      eventCounts[row.status] = Number(row.count);
      eventCounts.total += Number(row.count);
    });

    // 2. Registration Status Breakdown
    const [regStatusRows] = await pool.query(`
      SELECT 
        status, 
        COUNT(*) AS count 
      FROM registrations 
      GROUP BY status
    `);

    const registrationCounts = {
      total: 0,
      approved: 0,
      pending: 0,
      rejected: 0,
      cancelled: 0,
    };
    regStatusRows.forEach((row) => {
      registrationCounts[row.status] = Number(row.count);
      registrationCounts.total += Number(row.count);
    });

    // 3. Attendance Statistics & Confirmation Ratios
    const [attendanceRows] = await pool.query(`
      SELECT 
        check_in_status, 
        COUNT(*) AS count 
      FROM attendance 
      GROUP BY check_in_status
    `);

    let totalCheckedIn = 0;
    const attendanceBreakdown = {
      checked_in: 0,
      late: 0,
      absent: 0,
    };

    attendanceRows.forEach((row) => {
      attendanceBreakdown[row.check_in_status] = Number(row.count);
      if (row.check_in_status === 'checked_in' || row.check_in_status === 'late') {
        totalCheckedIn += Number(row.count);
      }
    });

    // Attendance Confirmation Ratio = (checked_in / approved_registrations) * 100
    const approvedCount = registrationCounts.approved || 0;
    const attendanceRatio = approvedCount > 0 
      ? Number(((totalCheckedIn / approvedCount) * 100).toFixed(1)) 
      : 0.0;

    // 4. Capacity & Utilization Across Published Events
    const [capacityRows] = await pool.query(`
      SELECT 
        COALESCE(SUM(capacity), 0) AS total_capacity,
        COALESCE(SUM(CASE WHEN status = 'published' THEN capacity ELSE 0 END), 0) AS published_capacity
      FROM events
    `);

    const publishedCapacity = Number(capacityRows[0].published_capacity) || 0;
    const activeRegistrations = (registrationCounts.approved || 0) + (registrationCounts.pending || 0);
    const capacityUtilization = publishedCapacity > 0 
      ? Number(((activeRegistrations / publishedCapacity) * 100).toFixed(1)) 
      : 0.0;

    // 5. Participant Demographics (Derived strictly from collected fields)
    const [domainRows] = await pool.query(`
      SELECT 
        SUBSTRING_INDEX(email, '@', -1) AS domain,
        COUNT(*) AS count
      FROM users
      GROUP BY domain
      ORDER BY count DESC
      LIMIT 5
    `);

    const [phoneRows] = await pool.query(`
      SELECT 
        COUNT(CASE WHEN phone_number IS NOT NULL AND phone_number != '' THEN 1 END) AS with_phone,
        COUNT(*) AS total_users
      FROM users
    `);

    const withPhone = Number(phoneRows[0].with_phone);
    const totalUsers = Number(phoneRows[0].total_users);
    const phoneCoverage = totalUsers > 0 ? Number(((withPhone / totalUsers) * 100).toFixed(1)) : 0.0;

    // 6. Event Type Distribution
    const [typeRows] = await pool.query(`
      SELECT 
        event_type, 
        COUNT(*) AS count 
      FROM events 
      GROUP BY event_type
    `);

    const eventTypes = {};
    typeRows.forEach((r) => {
      eventTypes[r.event_type] = Number(r.count);
    });

    return res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      metrics: {
        events: eventCounts,
        event_types: eventTypes,
        registrations: registrationCounts,
        attendance: {
          total_checked_in: totalCheckedIn,
          breakdown: attendanceBreakdown,
          confirmation_ratio_percentage: attendanceRatio,
          definition: 'Total attendees admitted (checked_in + late) divided by approved registrations multiplied by 100',
        },
        capacity: {
          published_capacity: publishedCapacity,
          active_reservations: activeRegistrations,
          utilization_percentage: capacityUtilization,
          remaining_seats: Math.max(0, publishedCapacity - activeRegistrations),
        },
        demographics: {
          total_users: totalUsers,
          top_email_domains: domainRows.map((d) => ({ domain: d.domain, count: Number(d.count) })),
          phone_coverage_percentage: phoneCoverage,
          data_collection_notice: 'Demographics strictly aggregated from user-provided email domains and contact phone presence.',
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/analytics/events
 * Event-level capacity, registration, and attendance breakdown.
 */
router.get('/events', async (req, res, next) => {
  try {
    const query = `
      SELECT 
        e.id,
        e.title,
        e.event_type,
        e.status,
        e.capacity,
        e.start_time,
        e.end_time,
        e.venue,
        COALESCE(COUNT(DISTINCT CASE WHEN r.status IN ('approved', 'pending') THEN r.id END), 0) AS registered_count,
        COALESCE(COUNT(DISTINCT CASE WHEN r.status = 'approved' THEN r.id END), 0) AS approved_count,
        COALESCE(COUNT(DISTINCT CASE WHEN r.status = 'pending' THEN r.id END), 0) AS pending_count,
        COALESCE(COUNT(DISTINCT CASE WHEN r.status = 'rejected' THEN r.id END), 0) AS rejected_count,
        COALESCE(COUNT(DISTINCT CASE WHEN r.status = 'cancelled' THEN r.id END), 0) AS cancelled_count,
        COALESCE(COUNT(DISTINCT a.id), 0) AS checked_in_count,
        GREATEST(0, e.capacity - COALESCE(COUNT(DISTINCT CASE WHEN r.status IN ('approved', 'pending') THEN r.id END), 0)) AS remaining_seats
      FROM events e
      LEFT JOIN registrations r ON e.id = r.event_id
      LEFT JOIN attendance a ON r.id = a.registration_id
      GROUP BY e.id
      ORDER BY e.start_time ASC
    `;

    const [rows] = await pool.query(query);

    const eventReports = rows.map((ev) => {
      const cap = Number(ev.capacity);
      const reg = Number(ev.registered_count);
      const app = Number(ev.approved_count);
      const chk = Number(ev.checked_in_count);
      const utilPct = cap > 0 ? Number(((reg / cap) * 100).toFixed(1)) : 0;
      const attRate = app > 0 ? Number(((chk / app) * 100).toFixed(1)) : 0;

      return {
        id: ev.id,
        title: ev.title,
        event_type: ev.event_type,
        status: ev.status,
        venue: ev.venue,
        start_time: ev.start_time,
        end_time: ev.end_time,
        capacity: cap,
        registered_count: reg,
        approved_count: app,
        pending_count: Number(ev.pending_count),
        rejected_count: Number(ev.rejected_count),
        cancelled_count: Number(ev.cancelled_count),
        checked_in_count: chk,
        remaining_seats: Number(ev.remaining_seats),
        capacity_utilization_pct: utilPct,
        attendance_rate_pct: attRate,
      };
    });

    return res.status(200).json({
      success: true,
      count: eventReports.length,
      events: eventReports,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Safely escapes a value for inclusion in an RFC 4180-compliant CSV row,
 * with comprehensive mitigation against CSV / Spreadsheet Formula Injection (CWE-1236).
 *
 * Security Rules:
 * 1. Null / Undefined: returns empty quotes `""`.
 * 2. Numbers: Preserves legitimate negative, zero, and positive numbers (e.g. -5, 0, 10.5) without modification.
 * 3. Formula Injection Guard: If a string value begins with dangerous characters (=, @, \t, \r),
 *    OR if it begins with (+, -) followed by non-numeric text/formulas, it is prefixed with a single quote (')
 *    to force spreadsheet applications (Excel, Calc) to treat the cell strictly as literal text.
 * 4. Quotes Escaping: Internal double quotes are escaped as `""`, and the entire value is enclosed in `"..."`.
 *
 * @param {*} val - Cell value
 * @returns {string} Escaped CSV cell string
 */
function escapeCSV(val) {
  if (val === null || val === undefined) return '""';
  if (typeof val === 'number') return `"${val}"`;
  let str = String(val);
  const trimmed = str.trimStart();
  if (trimmed.length > 0) {
    const first = trimmed[0];
    // Neutralize dangerous formula trigger characters (=, @, tab, carriage return)
    if (first === '=' || first === '@' || first === '\t' || first === '\r') {
      str = "'" + str;
    } else if (first === '+' || first === '-') {
      // Preserve legitimate numeric values (integers, negative numbers, decimals)
      const isNum = /^[+-]?\d+(\.\d+)?$/.test(trimmed);
      if (!isNum) {
        str = "'" + str;
      }
    }
  }
  return `"${str.replace(/"/g, '""')}"`;
}

/**
 * GET /api/analytics/export/csv
 * Generates and downloads a CSV report of registrations and attendance.
 */
router.get('/export/csv', async (req, res, next) => {
  try {
    const query = `
      SELECT 
        r.id AS registration_id,
        r.ticket_code,
        r.ticket_tier,
        r.status AS registration_status,
        r.registration_date,
        u.id AS user_id,
        u.full_name AS attendee_name,
        u.email AS attendee_email,
        u.phone_number,
        e.id AS event_id,
        e.title AS event_title,
        e.event_type,
        e.venue,
        e.start_time,
        a.check_in_time,
        a.check_in_status,
        a.notes AS check_in_notes
      FROM registrations r
      INNER JOIN users u ON r.user_id = u.id
      INNER JOIN events e ON r.event_id = e.id
      LEFT JOIN attendance a ON r.id = a.registration_id
      ORDER BY e.id ASC, r.registration_date ASC
    `;

    const [rows] = await pool.query(query);

    const headers = [
      'Registration ID',
      'Ticket Code',
      'Ticket Tier',
      'Registration Status',
      'Registration Date',
      'User ID',
      'Attendee Name',
      'Attendee Email',
      'Phone Number',
      'Event ID',
      'Event Title',
      'Event Type',
      'Venue',
      'Event Start Time',
      'Check-In Status',
      'Check-In Time',
      'Check-In Notes',
    ];

    const csvLines = [headers.join(',')];

    rows.forEach((row) => {
      const line = [
        escapeCSV(row.registration_id),
        escapeCSV(row.ticket_code),
        escapeCSV(row.ticket_tier || 'general'),
        escapeCSV(row.registration_status),
        escapeCSV(row.registration_date ? new Date(row.registration_date).toISOString() : ''),
        escapeCSV(row.user_id),
        escapeCSV(row.attendee_name),
        escapeCSV(row.attendee_email),
        escapeCSV(row.phone_number || 'N/A'),
        escapeCSV(row.event_id),
        escapeCSV(row.event_title),
        escapeCSV(row.event_type),
        escapeCSV(row.venue),
        escapeCSV(row.start_time ? new Date(row.start_time).toISOString() : ''),
        escapeCSV(row.check_in_status || 'Not Checked In'),
        escapeCSV(row.check_in_time ? new Date(row.check_in_time).toISOString() : 'N/A'),
        escapeCSV(row.check_in_notes || ''),
      ];
      csvLines.push(line.join(','));
    });

    const csvContent = csvLines.join('\r\n');
    const filename = `stratosevent_roster_report_${Date.now()}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.status(200).send(csvContent);
  } catch (error) {
    next(error);
  }
});

router.escapeCSV = escapeCSV;
module.exports = router;
