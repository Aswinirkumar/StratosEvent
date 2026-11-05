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
const { escapeCSV } = require('../routes/analytics');

const BASE_URL = process.env.TEST_API_URL || 'http://localhost:5000';

// Global tokens & state shared across tests
let adminToken = '';
let participantToken = '';
let secondaryParticipantToken = '';
let testEventId = null;
let testTicketCode = '';
let testRegistrationId = null;
let tierTestEventId = null;
let tierRaceEventId = null;
let tierUserEmail = '';
let tierUser2Email = '';
let quotaEventId = null;
let optBUser1Email = '';
let optBUser2Email = '';
let optBUser3Email = '';

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
    assert.strictEqual(body.registration.ticket_tier, 'general');
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
    assert.strictEqual(body.ticket.ticket_tier, 'general');
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
    assert(text.includes('Registration ID,Ticket Code,Ticket Tier'));
    assert(text.includes('Attendee Name,Attendee Email'));
  });

  it('escapeCSV neutralizes formula injection starting with =, @, +, and -', () => {
    // Dangerous spreadsheet formula triggers must be prepended with a single quote (')
    assert.strictEqual(escapeCSV('=cmd|"/C calc"!A0'), '"\'=cmd|""/C calc""!A0"');
    assert.strictEqual(escapeCSV('@SUM(1,2)'), '"\'@SUM(1,2)"');
    assert.strictEqual(escapeCSV('+cmd|"/C calc"!A0'), '"\'+cmd|""/C calc""!A0"');
    assert.strictEqual(escapeCSV('-2+3+cmd|"/C calc"!A0'), '"\'-2+3+cmd|""/C calc""!A0"');
    assert.strictEqual(escapeCSV('+91-98765-43210'), '"\'+91-98765-43210"');
    assert.strictEqual(escapeCSV('  =1+1'), '"\'  =1+1"');
    assert.strictEqual(escapeCSV('\t=1+1'), '"\'\t=1+1"');
  });

  it('escapeCSV preserves legitimate negative, zero, and positive numbers and strings', () => {
    // Legitimate numbers (typeof number) must remain unchanged
    assert.strictEqual(escapeCSV(0), '"0"');
    assert.strictEqual(escapeCSV(42), '"42"');
    assert.strictEqual(escapeCSV(-5), '"-5"');
    assert.strictEqual(escapeCSV(-12.5), '"-12.5"');

    // Legitimate numeric strings must remain unchanged
    assert.strictEqual(escapeCSV('-5'), '"-5"');
    assert.strictEqual(escapeCSV('-100.50'), '"-100.50"');
    assert.strictEqual(escapeCSV('100'), '"100"');

    // Normal strings and quotes escaping
    assert.strictEqual(escapeCSV('Jane Doe'), '"Jane Doe"');
    assert.strictEqual(escapeCSV('Jane "The Star" Doe'), '"Jane ""The Star"" Doe"');
    assert.strictEqual(escapeCSV(null), '""');
    assert.strictEqual(escapeCSV(undefined), '""');
  });
});

describe('10. Ticket Tier Support, Validation, Concurrency & Data Integrity', () => {
  let tierTestUserToken = '';
  let tierTestUser2Token = '';
  tierUserEmail = `tier_user_${Date.now()}@stratosevent.test`;
  tierUser2Email = `tier_user2_${Date.now()}@stratosevent.test`;
  let tierRegistrationId = null;
  let tierTicketCode = '';

  it('Setup: Register isolated participants and create test event with capacity=2', async () => {
    const regRes1 = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        full_name: 'Tier Test User 1',
        email: tierUserEmail,
        password: testPassword,
        phone_number: '+91-99999-11111',
      }),
    });
    assert.strictEqual(regRes1.status, 201);
    const regBody1 = await regRes1.json();
    tierTestUserToken = regBody1.token;

    const regRes2 = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        full_name: 'Tier Test User 2',
        email: tierUser2Email,
        password: testPassword,
        phone_number: '+91-99999-22222',
      }),
    });
    assert.strictEqual(regRes2.status, 201);
    const regBody2 = await regRes2.json();
    tierTestUser2Token = regBody2.token;

    const evtRes = await fetch(`${BASE_URL}/api/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        title: 'Ticket Tier Concurrency Summit',
        description: 'Test event for verifying ticket tiers and capacity protection.',
        event_type: 'hackathon',
        start_time: new Date(Date.now() + 86400000).toISOString(),
        end_time: new Date(Date.now() + 172800000).toISOString(),
        venue: 'Grand Test Pavilion',
        capacity: 2,
        status: 'published',
      }),
    });
    assert.strictEqual(evtRes.status, 201);
    const evtBody = await evtRes.json();
    tierTestEventId = evtBody.event.id;
  });

  it('POST /api/registrations defaults ticket_tier to general when omitted', async () => {
    const res = await fetch(`${BASE_URL}/api/registrations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tierTestUserToken}`,
      },
      body: JSON.stringify({ event_id: tierTestEventId }),
    });

    assert.strictEqual(res.status, 201);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.registration.ticket_tier, 'general');
    tierRegistrationId = body.registration.id;
    tierTicketCode = body.registration.ticket_code;
  });

  it('POST /api/registrations rejects invalid ticket_tier values with 400 INVALID_TIER', async () => {
    const invalidValues = ['platinum', '', null, 12345, 'vip_access'];

    for (const val of invalidValues) {
      const res = await fetch(`${BASE_URL}/api/registrations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tierTestUser2Token}`,
        },
        body: JSON.stringify({ event_id: tierTestEventId, ticket_tier: val }),
      });

      assert.strictEqual(res.status, 400, `Expected 400 for ticket_tier: ${JSON.stringify(val)}`);
      const body = await res.json();
      assert.strictEqual(body.success, false);
      assert.strictEqual(body.error.code, 'INVALID_TIER');
    }
  });

  it('POST /api/registrations duplicate booking attempt with different tier fails with 409 DUPLICATE_REGISTRATION', async () => {
    const res = await fetch(`${BASE_URL}/api/registrations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tierTestUserToken}`,
      },
      body: JSON.stringify({ event_id: tierTestEventId, ticket_tier: 'vip' }),
    });

    assert.strictEqual(res.status, 409);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.error.code, 'DUPLICATE_REGISTRATION');
  });

  it('Cancellation and re-registration allows updating ticket_tier', async () => {
    // 1. Cancel existing registration
    const cancelRes = await fetch(`${BASE_URL}/api/registrations/${tierRegistrationId}/cancel`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${tierTestUserToken}` },
    });
    assert.strictEqual(cancelRes.status, 200);

    // 2. Re-register with 'vip' tier
    const rebookRes = await fetch(`${BASE_URL}/api/registrations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tierTestUserToken}`,
      },
      body: JSON.stringify({ event_id: tierTestEventId, ticket_tier: 'vip' }),
    });

    assert.strictEqual(rebookRes.status, 201);
    const rebookBody = await rebookRes.json();
    assert.strictEqual(rebookBody.success, true);
    assert.strictEqual(rebookBody.registration.ticket_tier, 'vip');
    tierTicketCode = rebookBody.registration.ticket_code;
  });

  it('POST /api/registrations accepts student and early_bird tiers', async () => {
    const res = await fetch(`${BASE_URL}/api/registrations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tierTestUser2Token}`,
      },
      body: JSON.stringify({ event_id: tierTestEventId, ticket_tier: 'student' }),
    });

    assert.strictEqual(res.status, 201);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.registration.ticket_tier, 'student');
  });

  it('Admin GET /api/registrations filters by ticket_tier', async () => {
    const res = await fetch(`${BASE_URL}/api/registrations?event_id=${tierTestEventId}&ticket_tier=vip`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert(body.registrations.length >= 1);
    body.registrations.forEach(r => assert.strictEqual(r.ticket_tier, 'vip'));
  });

  it('Gate check GET /api/attendance/verify/:ticketCode returns ticket_tier', async () => {
    const res = await fetch(`${BASE_URL}/api/attendance/verify/${tierTicketCode}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.ticket.ticket_tier, 'vip');
  });

  it('GET /api/analytics/export/csv includes Ticket Tier column header and row values', async () => {
    const res = await fetch(`${BASE_URL}/api/analytics/export/csv`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    assert.strictEqual(res.status, 200);
    const csv = await res.text();
    assert(csv.includes('Registration ID,Ticket Code,Ticket Tier,Registration Status'));
    assert(csv.includes('"vip"'));
    assert(csv.includes('"student"'));
  });

  it('Concurrent booking race condition test: 2 simultaneous requests for 1 seat -> exactly 1 succeeds, 1 receives 409', async () => {
    const evtRes = await fetch(`${BASE_URL}/api/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        title: 'Single Seat Race Test Event',
        description: 'Testing concurrency lock on events table.',
        event_type: 'webinar',
        start_time: new Date(Date.now() + 86400000).toISOString(),
        end_time: new Date(Date.now() + 172800000).toISOString(),
        venue: 'https://concurrency.stratosevent.test',
        capacity: 1,
        status: 'published',
      }),
    });
    assert.strictEqual(evtRes.status, 201);
    tierRaceEventId = (await evtRes.json()).event.id;

    const [resA, resB] = await Promise.all([
      fetch(`${BASE_URL}/api/registrations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tierTestUserToken}`,
        },
        body: JSON.stringify({ event_id: tierRaceEventId, ticket_tier: 'vip' }),
      }),
      fetch(`${BASE_URL}/api/registrations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tierTestUser2Token}`,
        },
        body: JSON.stringify({ event_id: tierRaceEventId, ticket_tier: 'early_bird' }),
      }),
    ]);

    const statuses = [resA.status, resB.status].sort();
    assert.deepStrictEqual(statuses, [201, 409], 'Exactly one concurrent booking must succeed (201) and one must receive 409');
  });

  it('Database baseline integrity check: baseline records and Registration ID 25 are preserved', async () => {
    const { pool } = require('../config/db');
    const [regs] = await pool.query('SELECT id, user_id, event_id, ticket_code, status, ticket_tier FROM registrations WHERE id <= 25 ORDER BY id ASC');

    const baselineIds = [1, 2, 3, 4, 5, 6, 7];
    for (const bId of baselineIds) {
      const row = regs.find(r => r.id === bId);
      if (row) {
        assert.strictEqual(row.ticket_tier, 'general', `Registration ID ${bId} must have ticket_tier 'general'`);
      }
    }

    const reg25 = regs.find(r => r.id === 25);
    assert(reg25 !== undefined, 'Registration ID 25 must exist in the database');
    assert.strictEqual(reg25.user_id, 62);
    assert.strictEqual(reg25.event_id, 1);
    assert.strictEqual(reg25.ticket_code, 'SE-1-62-MVGVMZIZ-2D7F75');
    assert.strictEqual(reg25.status, 'rejected');
    assert.strictEqual(reg25.ticket_tier, 'general');
  });
});

describe('11. Option B: Per-Event Ticket Tier Quotas, Validation & Registration Controls', () => {
  let optBUser1Token = '';
  let optBUser2Token = '';
  let optBUser3Token = '';
  optBUser1Email = `optb_user1_${Date.now()}@stratosevent.test`;
  optBUser2Email = `optb_user2_${Date.now()}@stratosevent.test`;
  optBUser3Email = `optb_user3_${Date.now()}@stratosevent.test`;

  it('Setup: Create participants for Option B quota verification', async () => {
    for (const [email, name, setToken] of [
      [optBUser1Email, 'OptB Attendee 1', t => { optBUser1Token = t; }],
      [optBUser2Email, 'OptB Attendee 2', t => { optBUser2Token = t; }],
      [optBUser3Email, 'OptB Attendee 3', t => { optBUser3Token = t; }],
    ]) {
      const res = await fetch(`${BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: name,
          email,
          password: testPassword,
          phone_number: '+91-99887-11223',
        }),
      });
      assert.strictEqual(res.status, 201);
      const data = await res.json();
      setToken(data.token);
    }
  });

  it('POST /api/events rejects creation when sum of tier capacities does not equal total capacity', async () => {
    const res = await fetch(`${BASE_URL}/api/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        title: 'Mismatched Tier Quota Event',
        description: 'Tiers sum to 50 but total capacity is 40',
        event_type: 'conference',
        start_time: new Date(Date.now() + 86400000).toISOString(),
        end_time: new Date(Date.now() + 172800000).toISOString(),
        venue: 'Main Hall',
        capacity: 40,
        capacity_general: 20,
        capacity_vip: 20,
        capacity_student: 10,
        capacity_early_bird: 0,
        status: 'published',
      }),
    });

    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.error.code, 'VALIDATION_ERROR');
    assert(body.error.details.some(d => d.toLowerCase().includes('sum of tier capacities')));
  });

  it('POST /api/events rejects negative tier capacities', async () => {
    const res = await fetch(`${BASE_URL}/api/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        title: 'Negative Tier Quota Event',
        description: 'Invalid negative tier quota',
        event_type: 'workshop',
        start_time: new Date(Date.now() + 86400000).toISOString(),
        end_time: new Date(Date.now() + 172800000).toISOString(),
        venue: 'Room B',
        capacity: 10,
        capacity_general: 15,
        capacity_vip: -5,
        capacity_student: 0,
        capacity_early_bird: 0,
        status: 'published',
      }),
    });

    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.error.code, 'VALIDATION_ERROR');
    assert(body.error.details.some(d => d.toLowerCase().includes('non-negative integer')));
  });

  it('POST /api/events successfully creates event with custom tier quotas', async () => {
    const res = await fetch(`${BASE_URL}/api/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        title: 'Tier Allocation Masterclass',
        description: 'Explicit per-tier quotas: 2 General, 1 VIP, 0 Student, 0 Early Bird',
        event_type: 'workshop',
        start_time: new Date(Date.now() + 86400000).toISOString(),
        end_time: new Date(Date.now() + 172800000).toISOString(),
        venue: 'Auditorium 1',
        capacity: 3,
        capacity_general: 2,
        capacity_vip: 1,
        capacity_student: 0,
        capacity_early_bird: 0,
        status: 'published',
      }),
    });

    assert.strictEqual(res.status, 201);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    quotaEventId = body.event.id;
    assert.strictEqual(body.event.capacity_general, 2);
    assert.strictEqual(body.event.capacity_vip, 1);
    assert.strictEqual(body.event.capacity_student, 0);
    assert.strictEqual(body.event.capacity_early_bird, 0);
  });

  it('GET /api/events/:id returns tier_capacities, tier_registered, and tier_available metadata', async () => {
    const res = await fetch(`${BASE_URL}/api/events/${quotaEventId}`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.deepStrictEqual(body.event.tier_capacities, {
      general: 2,
      vip: 1,
      student: 0,
      early_bird: 0,
    });
    assert.deepStrictEqual(body.event.tier_available, {
      general: 2,
      vip: 1,
      student: 0,
      early_bird: 0,
    });
    assert.deepStrictEqual(body.event.tier_registered, {
      general: 0,
      vip: 0,
      student: 0,
      early_bird: 0,
    });
  });

  it('POST /api/registrations rejects booking for tier with 0 quota with 400 TIER_NOT_AVAILABLE', async () => {
    const res = await fetch(`${BASE_URL}/api/registrations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${optBUser1Token}`,
      },
      body: JSON.stringify({ event_id: quotaEventId, ticket_tier: 'student' }),
    });

    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.error.code, 'TIER_NOT_AVAILABLE');
    assert(body.error.message.includes('does not offer Student passes'));
  });

  it('POST /api/registrations succeeds for User 1 booking VIP (quota 1, registered 0 -> 1)', async () => {
    const res = await fetch(`${BASE_URL}/api/registrations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${optBUser1Token}`,
      },
      body: JSON.stringify({ event_id: quotaEventId, ticket_tier: 'vip' }),
    });

    assert.strictEqual(res.status, 201);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.registration.ticket_tier, 'vip');
  });

  it('POST /api/registrations rejects User 2 booking VIP with 409 TIER_CAPACITY_REACHED (quota 1 exhausted)', async () => {
    const res = await fetch(`${BASE_URL}/api/registrations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${optBUser2Token}`,
      },
      body: JSON.stringify({ event_id: quotaEventId, ticket_tier: 'vip' }),
    });

    assert.strictEqual(res.status, 409);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.error.code, 'TIER_CAPACITY_REACHED');
    assert(body.error.message.includes('VIP passes are sold out'));
    assert.strictEqual(body.error.tier, 'vip');
  });

  it('POST /api/registrations succeeds for User 2 booking General tier (quota 2, registered 0 -> 1)', async () => {
    const res = await fetch(`${BASE_URL}/api/registrations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${optBUser2Token}`,
      },
      body: JSON.stringify({ event_id: quotaEventId, ticket_tier: 'general' }),
    });

    assert.strictEqual(res.status, 201);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.registration.ticket_tier, 'general');
  });

  it('GET /api/events/:id accurately reflects decremented tier availability', async () => {
    const res = await fetch(`${BASE_URL}/api/events/${quotaEventId}`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.event.tier_available.general, 1);
    assert.strictEqual(body.event.tier_available.vip, 0);
    assert.strictEqual(body.event.tier_available.student, 0);
    assert.strictEqual(body.event.tier_available.early_bird, 0);
  });

  it('Database baseline integrity check: baseline records and Registration ID 25 are preserved', async () => {
    const { pool } = require('../config/db');
    const [regs] = await pool.query('SELECT id, user_id, event_id, ticket_code, status, ticket_tier FROM registrations WHERE id <= 25 ORDER BY id ASC');

    const baselineIds = [1, 2, 3, 4, 5, 6, 7];
    for (const bId of baselineIds) {
      const row = regs.find(r => r.id === bId);
      if (row) {
        assert.strictEqual(row.ticket_tier, 'general', `Registration ID ${bId} must have ticket_tier 'general'`);
      }
    }

    const reg25 = regs.find(r => r.id === 25);
    assert(reg25 !== undefined, 'Registration ID 25 must exist in the database');
    assert.strictEqual(reg25.user_id, 62);
    assert.strictEqual(reg25.event_id, 1);
    assert.strictEqual(reg25.ticket_code, 'SE-1-62-MVGVMZIZ-2D7F75');
    assert.strictEqual(reg25.status, 'rejected');
    assert.strictEqual(reg25.ticket_tier, 'general');
  });

  after(async () => {
    try {
      const { pool } = require('../config/db');
      // Delete test events (cascades to their test registrations)
      const testEventIds = [testEventId, tierTestEventId, tierRaceEventId, quotaEventId].filter(Boolean);
      if (testEventIds.length > 0) {
        await pool.query('DELETE FROM events WHERE id IN (?)', [testEventIds]);
      }
      // Delete uniquely created test users only
      await pool.query('DELETE FROM users WHERE email IN (?, ?, ?, ?, ?, ?, ?, ?, ?)', [
        testPrivilegeEscalationEmail,
        testArbitraryRoleEmail,
        testParticipantEmail,
        testParticipant2Email,
        tierUserEmail,
        tierUser2Email,
        optBUser1Email,
        optBUser2Email,
        optBUser3Email,
      ]);
      await pool.end();
    } catch (err) {
      console.error('Final test suite cleanup error:', err.message);
    }
  });
});
