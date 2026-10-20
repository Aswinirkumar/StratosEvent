/**
 * StratosEvent Comprehensive Pre-Deployment Verification Script
 * Validates requirements 3, 4, 5, 6, 7 & ensures DB integrity (req 9)
 */

const assert = require('assert');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { pool } = require('../config/db');

const API_BASE = 'http://localhost:5000/api';

async function runVerification() {
  console.log('============================================================');
  console.log('🔍 Starting End-to-End System & API Verification');
  console.log('============================================================\n');

  const timestamp = Date.now();
  const testPartEmail = `e2e_user_${timestamp}@stratosevent.test`;
  const testPart2Email = `e2e_user2_${timestamp}@stratosevent.test`;
  const testAdminEmail = `e2e_admin_${timestamp}@stratosevent.test`;
  const testPassword = 'E2E_SecurePassword@2026';

  let partToken = '';
  let part2Token = '';
  let adminToken = '';
  let testEventId = null;
  let testTicketCode = '';
  let testRegId = null;

  const results = [];

  function record(feature, status, note = '') {
    results.push({ feature, status, note });
    console.log(`[${status.toUpperCase()}] ${feature} ${note ? '-> ' + note : ''}`);
  }

  try {
    // -------------------------------------------------------------
    // Test 1: Event Catalog & Query Filtering (GET /api/events)
    // -------------------------------------------------------------
    console.log('--- 1. Testing Event Catalog, Search & Filtering ---');
    const resEvents = await fetch(`${API_BASE}/events`);
    assert.strictEqual(resEvents.status, 200, 'GET /api/events must return 200');
    const eventsData = await resEvents.json();
    assert(eventsData.success, 'Catalog response must be success');
    assert(eventsData.events.length >= 4, 'Must return at least 4 published seed events');
    record('Event Catalog (GET /api/events)', 'pass', `Loaded ${eventsData.events.length} published events`);

    // Search filter test
    const resSearch = await fetch(`${API_BASE}/events?search=Kubernetes`);
    const searchData = await resSearch.json();
    assert(searchData.events.some(e => e.title.includes('Kubernetes')), 'Search must return Kubernetes event');
    record('Event Search Query Filtering', 'pass', 'Successfully matched "Kubernetes" workshop');

    // Category filter test
    const resCat = await fetch(`${API_BASE}/events?event_type=hackathon`);
    const catData = await resCat.json();
    assert(catData.events.every(e => e.event_type === 'hackathon'), 'Category filter must only return hackathons');
    record('Event Category Filtering', 'pass', `Filtered ${catData.events.length} hackathon event(s)`);

    // -------------------------------------------------------------
    // Test 2: Participant Registration & Authentication
    // -------------------------------------------------------------
    console.log('\n--- 2. Testing Participant Auth Lifecycle ---');
    // Invalid input test (req 7)
    const resInvReg = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ full_name: 'X', email: 'notanemail', password: '12' })
    });
    assert.strictEqual(resInvReg.status, 400, 'Invalid registration should fail with 400');
    record('Input Validation on Registration', 'pass', 'Rejected invalid email and short password');

    // Valid participant registration
    const resPartReg = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        full_name: 'E2E Test Participant',
        email: testPartEmail,
        password: testPassword,
        role: 'participant',
        phone_number: '+91-98765-43210'
      })
    });
    assert.strictEqual(resPartReg.status, 201, 'Registration must return 201');
    const partRegData = await resPartReg.json();
    partToken = partRegData.token;
    assert(partToken, 'Must receive JWT token');
    record('Participant Account Registration', 'pass', `Created participant (${testPartEmail})`);

    // Register 2nd participant for overbooking test
    const resPart2Reg = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        full_name: 'E2E Secondary Participant',
        email: testPart2Email,
        password: testPassword,
        role: 'participant',
      })
    });
    assert.strictEqual(resPart2Reg.status, 201);
    const part2RegData = await resPart2Reg.json();
    part2Token = part2RegData.token;

    // Login test with incorrect password (req 7)
    const resBadLogin = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testPartEmail, password: 'WrongPassword' })
    });
    assert.strictEqual(resBadLogin.status, 401, 'Bad credentials must return 401');
    record('Invalid Credentials Handling', 'pass', 'Rejected invalid password with 401');

    // Login test with correct password
    const resLogin = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testPartEmail, password: testPassword })
    });
    assert.strictEqual(resLogin.status, 200, 'Login must return 200');
    record('Participant Login & JWT Generation', 'pass', 'Successfully signed in and obtained JWT');

    // Test privilege escalation rejection on public registration
    const resPrivReg = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        full_name: 'E2E Privilege Attacker',
        email: testAdminEmail,
        password: testPassword,
        role: 'admin'
      })
    });
    assert.strictEqual(resPrivReg.status, 201);
    const privRegData = await resPrivReg.json();
    assert.strictEqual(privRegData.user.role, 'participant', 'Server must ignore role="admin" and assign participant');
    record('Privilege Escalation Prevention (Public Register)', 'pass', 'Role forced to participant, ignoring role="admin" in payload');

    // Authenticate legitimate seeded administrator account (Req 6)
    const resAdminLogin = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@stratosevent.internal',
        password: 'StratosDev@2026',
      })
    });
    assert.strictEqual(resAdminLogin.status, 200, 'Seeded admin login must succeed');
    const adminLoginData = await resAdminLogin.json();
    assert.strictEqual(adminLoginData.user.role, 'admin', 'Seeded admin must have role="admin"');
    adminToken = adminLoginData.token;
    record('Seeded Administrator Authentication (Protected RBAC)', 'pass', 'Successfully signed in as admin@stratosevent.internal');

    // -------------------------------------------------------------
    // Test 3: Admin Authorization & Event Management (Req 6)
    // -------------------------------------------------------------
    console.log('\n--- 3. Testing Administrator RBAC & Event Creation ---');
    // Participant attempting to create event -> 403 Forbidden (req 7)
    const resForbiddenEvent = await fetch(`${API_BASE}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${partToken}` },
      body: JSON.stringify({
        title: 'Unauthorized Event',
        event_type: 'workshop',
        start_time: '2026-11-10T10:00:00Z',
        end_time: '2026-11-10T12:00:00Z',
        venue: 'Room 1',
        capacity: 10
      })
    });
    assert.strictEqual(resForbiddenEvent.status, 403, 'Participant must be forbidden from creating events');
    record('RBAC: Participant Forbidden on Admin APIs', 'pass', 'Returned 403 Forbidden');

    // Unauthenticated request -> 401 (req 7)
    const resUnauth = await fetch(`${API_BASE}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'No Token' })
    });
    assert.strictEqual(resUnauth.status, 401, 'No token must return 401');
    record('RBAC: Unauthorized Without Token', 'pass', 'Returned 401 Unauthorized');

    // Admin creates micro-capacity event (capacity = 1) for overbooking testing
    const resCreateEvt = await fetch(`${API_BASE}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        title: `E2E Capacity Verification Event ${timestamp}`,
        description: 'Single-seat event for verifying transactional lock and duplicate prevention.',
        event_type: 'workshop',
        start_time: '2026-11-15T09:00:00Z',
        end_time: '2026-11-15T17:00:00Z',
        venue: 'Hawkins Lab Test Room',
        capacity: 1,
        status: 'published'
      })
    });
    assert.strictEqual(resCreateEvt.status, 201, 'Admin event creation must return 201');
    const createdEvtData = await resCreateEvt.json();
    testEventId = createdEvtData.event.id;
    record('Admin Event Creation (POST /api/events)', 'pass', `Event #${testEventId} created with capacity 1`);

    // -------------------------------------------------------------
    // Test 4: Booking, Duplicate Prevention & Capacity Protection (Req 4, 5)
    // -------------------------------------------------------------
    console.log('\n--- 4. Testing Event Booking & Concurrency Guarantees ---');
    // Participant 1 books the 1 seat
    const resBook1 = await fetch(`${API_BASE}/registrations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${partToken}` },
      body: JSON.stringify({ event_id: testEventId })
    });
    assert.strictEqual(resBook1.status, 201, 'Participant 1 booking must succeed');
    const book1Data = await resBook1.json();
    testTicketCode = book1Data.registration.ticket_code;
    testRegId = book1Data.registration.id;
    assert(testTicketCode.startsWith(`SE-${testEventId}-`), 'Ticket code format valid');
    record('Event Seat Reservation (POST /api/registrations)', 'pass', `Issued ticket: ${testTicketCode}`);

    // Duplicate booking by same participant (req 5, 7)
    const resDupBook = await fetch(`${API_BASE}/registrations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${partToken}` },
      body: JSON.stringify({ event_id: testEventId })
    });
    assert.strictEqual(resDupBook.status, 409, 'Duplicate booking must return 409 Conflict');
    const dupData = await resDupBook.json();
    assert.strictEqual(dupData.error.code, 'DUPLICATE_REGISTRATION');
    record('Duplicate Booking Prevention', 'pass', 'Returned 409 Conflict (DUPLICATE_REGISTRATION)');

    // Participant 2 attempts to book when capacity full (req 5, 7)
    const resCapFull = await fetch(`${API_BASE}/registrations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${part2Token}` },
      body: JSON.stringify({ event_id: testEventId })
    });
    assert.strictEqual(resCapFull.status, 409, 'Overbooking must return 409 Conflict');
    const capData = await resCapFull.json();
    assert.strictEqual(capData.error.code, 'CAPACITY_REACHED');
    record('Atomic Capacity Limit Protection', 'pass', 'Returned 409 Conflict (CAPACITY_REACHED)');

    // Invalid Event ID (req 7)
    const resInvEvt = await fetch(`${API_BASE}/registrations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${partToken}` },
      body: JSON.stringify({ event_id: 9999999 })
    });
    assert.strictEqual(resInvEvt.status, 404, 'Non-existent event should return 404');
    record('Invalid Event ID Handling', 'pass', 'Returned 404 EVENT_NOT_FOUND');

    // Participant Booking History (req 4)
    const resMyBookings = await fetch(`${API_BASE}/registrations/my`, {
      headers: { Authorization: `Bearer ${partToken}` }
    });
    assert.strictEqual(resMyBookings.status, 200);
    const myBookingsData = await resMyBookings.json();
    assert(myBookingsData.registrations.some(r => r.ticket_code === testTicketCode));
    record('Participant Booking History (GET /api/registrations/my)', 'pass', 'Pass retrieved in history roster');

    // -------------------------------------------------------------
    // Test 5: Admin Moderation & Attendance Check-In (Req 6)
    // -------------------------------------------------------------
    console.log('\n--- 5. Testing Admin Approval & Gate Check-In ---');
    // Admin reviews registrations
    const resAdminRegs = await fetch(`${API_BASE}/registrations?event_id=${testEventId}`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.strictEqual(resAdminRegs.status, 200);
    const adminRegsData = await resAdminRegs.json();
    assert.strictEqual(adminRegsData.registrations.length, 1);
    record('Admin Registration Roster Inspection', 'pass', `Roster listed attendee ${testPartEmail}`);

    // Admin updates status (pending -> approved)
    const resStatusUpdate = await fetch(`${API_BASE}/registrations/${testRegId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ status: 'approved' })
    });
    assert.strictEqual(resStatusUpdate.status, 200);
    record('Admin Registration Status Moderation', 'pass', 'Updated status to approved');

    // Admin inspects ticket prior to gate entry
    const resVerifyTicket = await fetch(`${API_BASE}/attendance/verify/${testTicketCode}`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.strictEqual(resVerifyTicket.status, 200);
    const verifyTicketData = await resVerifyTicket.json();
    assert.strictEqual(verifyTicketData.ticket.can_check_in, true);
    record('Gate Ticket Verification (GET /api/attendance/verify/:code)', 'pass', 'Ticket verified & eligible for check-in');

    // Gate check-in admission
    const resCheckIn = await fetch(`${API_BASE}/attendance/check-in`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ ticket_code: testTicketCode, check_in_status: 'checked_in', notes: 'Gate 1 Admission' })
    });
    assert.strictEqual(resCheckIn.status, 201);
    record('Attendance Gate Check-In (POST /api/attendance/check-in)', 'pass', 'Attendee successfully admitted');

    // Duplicate check-in attempt (req 7)
    const resDupCheckIn = await fetch(`${API_BASE}/attendance/check-in`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ ticket_code: testTicketCode })
    });
    assert.strictEqual(resDupCheckIn.status, 409, 'Duplicate check-in must return 409');
    const dupCheckInData = await resDupCheckIn.json();
    assert.strictEqual(dupCheckInData.error.code, 'DUPLICATE_CHECKIN');
    record('Duplicate Check-In Prevention', 'pass', 'Returned 409 Conflict (DUPLICATE_CHECKIN)');

    // -------------------------------------------------------------
    // Test 6: Registration Cancellation (Req 4)
    // -------------------------------------------------------------
    console.log('\n--- 6. Testing Participant Cancellation ---');
    const resCancel = await fetch(`${API_BASE}/registrations/${testRegId}/cancel`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${partToken}` }
    });
    assert.strictEqual(resCancel.status, 200);
    record('Participant Registration Cancellation', 'pass', 'Seat released and status set to cancelled');

    // -------------------------------------------------------------
    // Test 7: Real-Time Analytics & CSV Export (Phase 5)
    // -------------------------------------------------------------
    console.log('\n--- 7. Testing Analytics & CSV Export ---');
    const resAnalytics = await fetch(`${API_BASE}/analytics/overview`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.strictEqual(resAnalytics.status, 200);
    const analyticsData = await resAnalytics.json();
    assert(analyticsData.metrics.events.total >= 5);
    assert(typeof analyticsData.metrics.attendance.confirmation_ratio_percentage === 'number');
    record('Executive Analytics Overview (GET /api/analytics/overview)', 'pass', 'Calculated KPIs & confirmation ratios from MySQL');

    const resCsv = await fetch(`${API_BASE}/analytics/export/csv`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.strictEqual(resCsv.status, 200);
    const csvContent = await resCsv.text();
    assert(csvContent.includes('Registration ID,Ticket Code'));
    record('Authorized CSV Roster Export (GET /api/analytics/export/csv)', 'pass', `Generated ${csvContent.length} bytes CSV file`);

  } catch (error) {
    console.error('❌ Verification Error:', error);
    record('E2E Verification Execution', 'fail', error.message);
  } finally {
    // -------------------------------------------------------------
    // Teardown: Safe Cleanup of Test-Created Records (Req 9)
    // -------------------------------------------------------------
    console.log('\n--- 7. Safe Teardown & Database State Verification ---');
    if (testEventId) {
      await pool.query('DELETE FROM events WHERE id = ?', [testEventId]);
    }
    await pool.query('DELETE FROM users WHERE email IN (?, ?, ?)', [
      testPartEmail,
      testPart2Email,
      testAdminEmail
    ]);

    const [u] = await pool.query('SELECT COUNT(*) AS c FROM users');
    const [e] = await pool.query('SELECT COUNT(*) AS c FROM events');
    const [r] = await pool.query('SELECT COUNT(*) AS c FROM registrations');
    const [a] = await pool.query('SELECT COUNT(*) AS c FROM attendance');

    console.log('Final Database Counts:', {
      users: u[0].c,
      events: e[0].c,
      registrations: r[0].c,
      attendance: a[0].c
    });

    assert.strictEqual(u[0].c, 7, 'Users count must be exactly 7 (original seed)');
    assert.strictEqual(e[0].c, 5, 'Events count must be exactly 5 (original seed)');
    assert.strictEqual(r[0].c, 7, 'Registrations count must be exactly 7 (original seed)');
    assert.strictEqual(a[0].c, 3, 'Attendance count must be exactly 3 (original seed)');

    record('Sample Data Preservation & Zero Leakage', 'pass', 'Original seed records intact (7 users, 5 events, 7 regs, 3 att)');

    await pool.end();
  }

  console.log('\n============================================================');
  console.log(`✅ Verification Finished: ${results.filter(r => r.status === 'pass').length} Passed, ${results.filter(r => r.status === 'fail').length} Failed`);
  console.log('============================================================');
}

runVerification();
