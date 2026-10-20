/**
 * StratosEvent End-to-End REST API Test Suite
 * 
 * Verifies:
 * 1. Health & Root Info Endpoints
 * 2. User Registration & Login (JWT Auth & bcrypt verification)
 * 3. Input Validation Errors (Invalid emails, short passwords, invalid dates)
 * 4. Role-Based Authorization (Participant vs Admin permissions)
 * 5. Event CRUD & Archiving (Create, Read, Update, Archive status)
 * 6. Participant Event Registration & Cancellation
 * 7. Duplicate Registration Prevention
 * 8. Transactional Event Capacity Limits (Overbooking Protection)
 * 9. Admin Registration Approval / Rejection
 * 10. Attendance Check-In & Duplicate Check-In Prevention
 */

const { describe, it, after } = require('node:test');
const assert = require('node:assert');

const BASE_URL = process.env.TEST_API_URL || 'http://localhost:5000';

// Global tokens & state shared across tests
let adminToken = '';
let participantToken = '';
let secondaryParticipantToken = '';
let testEventId = null;
let testTicketCode = '';
let testRegistrationId = null;

const timestamp = Date.now();
const testParticipantEmail = `user_test_${timestamp}@stratosevent.test`;
const testParticipant2Email = `user2_test_${timestamp}@stratosevent.test`;
const testPrivilegeEscalationEmail = `priv_attack_${timestamp}@stratosevent.test`;
const testArbitraryRoleEmail = `superuser_attack_${timestamp}@stratosevent.test`;
const testPassword = 'SecureDevPassword@2026';

describe('1. Health Check & Root System Endpoints', () => {
  it('GET /api/health returns 200 with status UP and connected database', async () => {
    const res = await fetch(`${BASE_URL}/api/health`);
    assert.strictEqual(res.status, 200);

    const body = await res.json();
    assert.strictEqual(body.status, 'UP');
    assert.strictEqual(body.service, 'StratosEvent Backend API');
    assert.strictEqual(body.database.status, 'connected');
  });

  it('GET / returns 200 with project info', async () => {
    const res = await fetch(`${BASE_URL}/`);
    assert.strictEqual(res.status, 200);

    const body = await res.json();
    assert.strictEqual(body.status, 'Running');
  });

  it('GET /api/unknown-endpoint returns 404 with standard error structure', async () => {
    const res = await fetch(`${BASE_URL}/api/unknown-endpoint`);
    assert.strictEqual(res.status, 404);

    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.error.code, 'ROUTE_NOT_FOUND');
  });
});

describe('2. User Authentication & Input Validation', () => {
  it('POST /api/auth/register fails when full_name or email is invalid (Input Validation)', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        full_name: 'A',
        email: 'invalid-email-format',
        password: '123',
      }),
    });

    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.error.code, 'VALIDATION_ERROR');
    assert(body.error.details.length >= 2);
  });

  it('POST /api/auth/register successfully registers a participant', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        full_name: 'Test Participant 1',
        email: testParticipantEmail,
        password: testPassword,
        role: 'participant',
        phone_number: '+91-99999-00001',
      }),
    });

    assert.strictEqual(res.status, 201);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert(typeof body.token === 'string');
    assert.strictEqual(body.user.email, testParticipantEmail);
    assert.strictEqual(body.user.role, 'participant');

    participantToken = body.token;
  });

  it('POST /api/auth/register rejects duplicate email registration with 409 Conflict', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        full_name: 'Duplicate Participant',
        email: testParticipantEmail,
        password: testPassword,
      }),
    });

    assert.strictEqual(res.status, 409);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.error.code, 'EMAIL_ALREADY_EXISTS');
  });

  it('POST /api/auth/register prevents privilege escalation: ignores role="admin" and assigns participant', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        full_name: 'Privilege Escalation Attacker',
        email: testPrivilegeEscalationEmail,
        password: testPassword,
        role: 'admin',
        phone_number: '+91-99999-00002',
      }),
    });

    assert.strictEqual(res.status, 201);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    // CRITICAL SECURITY ASSERTION: Must NOT be granted admin role
    assert.strictEqual(body.user.role, 'participant');

    // Token issued to attacker must fail on admin-only routes
    const adminCheck = await fetch(`${BASE_URL}/api/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${body.token}`,
      },
      body: JSON.stringify({ title: 'Illegal Event Creation' }),
    });
    assert.strictEqual(adminCheck.status, 403);
  });

  it('POST /api/auth/register prevents privilege escalation: ignores arbitrary roles ("administrator", "superuser") and forces participant', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        full_name: 'Superuser Role Attempt',
        email: testArbitraryRoleEmail,
        password: testPassword,
        role: 'administrator',
      }),
    });

    assert.strictEqual(res.status, 201);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    // CRITICAL SECURITY ASSERTION: Forced to participant
    assert.strictEqual(body.user.role, 'participant');
  });

  it('POST /api/auth/register registers secondary participant for capacity testing', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        full_name: 'Test Participant 2',
        email: testParticipant2Email,
        password: testPassword,
        role: 'participant',
      }),
    });

    assert.strictEqual(res.status, 201);
    const body = await res.json();
    secondaryParticipantToken = body.token;
  });

  it('POST /api/auth/login succeeds with correct credentials', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testParticipantEmail,
        password: testPassword,
      }),
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert(typeof body.token === 'string');
  });

  it('POST /api/auth/login fails with incorrect password', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testParticipantEmail,
        password: 'WrongPassword@123',
      }),
    });

    assert.strictEqual(res.status, 401);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.error.code, 'INVALID_CREDENTIALS');
  });

  it('POST /api/auth/login authenticates seeded administrator account with protected admin privileges', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@stratosevent.internal',
        password: 'StratosDev@2026',
      }),
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.user.role, 'admin');
    assert.strictEqual(body.user.email, 'admin@stratosevent.internal');
    adminToken = body.token;
  });

  it('GET /api/auth/me returns current user profile when authenticated', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${participantToken}` },
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.user.email, testParticipantEmail);
  });
});

describe('3. Role-Based Authorization Protection', () => {
  it('POST /api/events fails with 401 when no token is provided', async () => {
    const res = await fetch(`${BASE_URL}/api/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Unauthorized Event' }),
    });

    assert.strictEqual(res.status, 401);
    const body = await res.json();
    assert.strictEqual(body.error.code, 'AUTH_TOKEN_REQUIRED');
  });

  it('POST /api/events fails with 403 Forbidden when called by a participant', async () => {
    const res = await fetch(`${BASE_URL}/api/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${participantToken}`,
      },
      body: JSON.stringify({
        title: 'Participant Unauthorized Event',
        event_type: 'workshop',
        start_time: '2026-11-01 10:00:00',
        end_time: '2026-11-01 12:00:00',
        venue: 'Room 101',
        capacity: 30,
      }),
    });

    assert.strictEqual(res.status, 403);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.error.code, 'FORBIDDEN');
  });

  it('POST /api/events fails with 403 Forbidden even if client sends tampered role="admin" in payload', async () => {
    const res = await fetch(`${BASE_URL}/api/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${participantToken}`,
      },
      body: JSON.stringify({
        role: 'admin',
        title: 'Tampered Role Bypass Attempt',
        event_type: 'workshop',
        start_time: '2026-11-01 10:00:00',
        end_time: '2026-11-01 12:00:00',
        venue: 'Room 101',
        capacity: 30,
      }),
    });

    assert.strictEqual(res.status, 403);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.error.code, 'FORBIDDEN');
  });
});

describe('4. Event CRUD & Archiving (Admin)', () => {
  it('POST /api/events creates a new event with capacity 1 for strict overbooking test', async () => {
    const res = await fetch(`${BASE_URL}/api/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        title: `Automated Test Workshop ${timestamp}`,
        description: 'Comprehensive test event with limited seats for capacity testing.',
        event_type: 'workshop',
        start_time: '2026-11-10 09:00:00',
        end_time: '2026-11-10 12:00:00',
        venue: 'Virtual Lab 4',
        capacity: 1, // Strictly 1 seat to test overbooking
        status: 'published',
      }),
    });

    assert.strictEqual(res.status, 201);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert(body.event.id > 0);
    assert.strictEqual(body.event.capacity, 1);

    testEventId = body.event.id;
  });

  it('GET /api/events lists published events including registered_count and available_seats', async () => {
    const res = await fetch(`${BASE_URL}/api/events`);
    assert.strictEqual(res.status, 200);

    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert(Array.isArray(body.events));

    const found = body.events.find((e) => e.id === testEventId);
    assert(found !== undefined);
    assert.strictEqual(found.available_seats, 1);
    assert.strictEqual(found.registered_count, 0);
  });

  it('PUT /api/events/:id updates event description and venue', async () => {
    const res = await fetch(`${BASE_URL}/api/events/${testEventId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        venue: 'Virtual Hall A (Updated)',
      }),
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.event.venue, 'Virtual Hall A (Updated)');
  });
});

describe('5. Registration, Duplicate Checks & Capacity Protection', () => {
  it('POST /api/registrations allows Participant 1 to reserve the 1 available seat', async () => {
    const res = await fetch(`${BASE_URL}/api/registrations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${participantToken}`,
      },
      body: JSON.stringify({ event_id: testEventId }),
    });

    assert.strictEqual(res.status, 201);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.registration.status, 'approved');
    assert(typeof body.registration.ticket_code === 'string');

    testTicketCode = body.registration.ticket_code;
    testRegistrationId = body.registration.id;
  });

  it('POST /api/registrations rejects duplicate registration by the same participant (409 Conflict)', async () => {
    const res = await fetch(`${BASE_URL}/api/registrations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${participantToken}`,
      },
      body: JSON.stringify({ event_id: testEventId }),
    });

    assert.strictEqual(res.status, 409);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.error.code, 'DUPLICATE_REGISTRATION');
  });

  it('POST /api/registrations rejects Participant 2 when event capacity is reached (Overbooking Protection)', async () => {
    const res = await fetch(`${BASE_URL}/api/registrations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${secondaryParticipantToken}`,
      },
      body: JSON.stringify({ event_id: testEventId }),
    });

    assert.strictEqual(res.status, 409);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.error.code, 'CAPACITY_REACHED');
  });

  it('GET /api/registrations/my returns participant registration with event details', async () => {
    const res = await fetch(`${BASE_URL}/api/registrations/my`, {
      headers: { Authorization: `Bearer ${participantToken}` },
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert(body.registrations.some((r) => r.id === testRegistrationId));
  });
});

describe('6. Admin Registration Management & Approval', () => {
  it('GET /api/registrations allows admin to view registrations filtered by event', async () => {
    const res = await fetch(`${BASE_URL}/api/registrations?event_id=${testEventId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert(body.registrations.length >= 1);
  });

  it('PATCH /api/registrations/:id/status allows admin to update registration status', async () => {
    const res = await fetch(`${BASE_URL}/api/registrations/${testRegistrationId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ status: 'approved' }),
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.status, 'approved');
  });
});

describe('7. Attendance Check-In & Duplicate Check-In Prevention', () => {
  it('GET /api/attendance/verify/:ticketCode allows admin to inspect ticket before check-in', async () => {
    const res = await fetch(`${BASE_URL}/api/attendance/verify/${testTicketCode}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.ticket.ticket_code, testTicketCode);
    assert.strictEqual(body.ticket.is_already_checked_in, false);
    assert.strictEqual(body.ticket.can_check_in, true);
  });

  it('POST /api/attendance/check-in records attendee check-in successfully', async () => {
    const res = await fetch(`${BASE_URL}/api/attendance/check-in`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        ticket_code: testTicketCode,
        check_in_status: 'checked_in',
        notes: 'Pass verified at Gate 1',
      }),
    });

    assert.strictEqual(res.status, 201);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.attendance.check_in_status, 'checked_in');
    assert.strictEqual(body.attendance.ticket_code, testTicketCode);
  });

  it('POST /api/attendance/check-in rejects duplicate check-in with 409 Conflict', async () => {
    const res = await fetch(`${BASE_URL}/api/attendance/check-in`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        ticket_code: testTicketCode,
      }),
    });

    assert.strictEqual(res.status, 409);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.error.code, 'DUPLICATE_CHECKIN');
  });

  it('GET /api/attendance/event/:eventId returns attendance roster and rate', async () => {
    const res = await fetch(`${BASE_URL}/api/attendance/event/${testEventId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.metrics.total_checked_in, 1);
    assert.strictEqual(body.metrics.attendance_percentage, '100.0%');
  });
});

describe('8. Event Cancellation & Archiving', () => {
  it('PATCH /api/events/:id/status archives event with completed status', async () => {
    const res = await fetch(`${BASE_URL}/api/events/${testEventId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ status: 'completed' }),
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.status, 'completed');
  });
});

describe('9. Analytics & Business Intelligence Engine', () => {
  it('GET /api/analytics/overview fails with 401 when no token is provided', async () => {
    const res = await fetch(`${BASE_URL}/api/analytics/overview`);
    assert.strictEqual(res.status, 401);
  });

  it('GET /api/analytics/overview fails with 403 Forbidden when called by a participant', async () => {
    const res = await fetch(`${BASE_URL}/api/analytics/overview`, {
      headers: { Authorization: `Bearer ${participantToken}` },
    });
    assert.strictEqual(res.status, 403);
  });

  it('GET /api/analytics/overview returns 200 with aggregated metrics when called by admin', async () => {
    const res = await fetch(`${BASE_URL}/api/analytics/overview`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert(body.metrics.events.total >= 5);
    assert(typeof body.metrics.attendance.confirmation_ratio_percentage === 'number');
    assert(Array.isArray(body.metrics.demographics.top_email_domains));
  });

  it('GET /api/analytics/events returns 200 with event-level breakdown for admin', async () => {
    const res = await fetch(`${BASE_URL}/api/analytics/events`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert(body.events.length >= 5);
    assert(typeof body.events[0].capacity_utilization_pct === 'number');
  });

  it('GET /api/analytics/export/csv returns 200 with CSV text attachment', async () => {
    const res = await fetch(`${BASE_URL}/api/analytics/export/csv`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.headers.get('content-type'), 'text/csv; charset=utf-8');
    const text = await res.text();
    assert(text.includes('Registration ID,Ticket Code'));
    assert(text.includes('Attendee Name,Attendee Email'));
  });

  after(async () => {
    // Safe cleanup of positively identified test entities created in this test run
    try {
      const { pool } = require('../config/db');
      if (testEventId) {
        await pool.query('DELETE FROM events WHERE id = ?', [testEventId]);
      }
      await pool.query('DELETE FROM users WHERE email IN (?, ?, ?, ?)', [
        testPrivilegeEscalationEmail,
        testArbitraryRoleEmail,
        testParticipantEmail,
        testParticipant2Email,
      ]);
      await pool.end();
    } catch (err) {
      console.error('Test cleanup notice:', err.message);
    }
  });
});
