# StratosEvent — Software Requirements Specification (SRS)

**Document Version**: 2.0  
**Project**: StratosEvent — Enterprise Event Management and Registration Platform  
**Target Organization**: TCS iON Industry Project  
**Author**: StratosEvent Development Team  
**Status**: Approved & Verified  

---

## 1. Introduction & Problem Statement

### 1.1 Background & Context
Organizing campus symposiums, enterprise workshops, technical hackathons, and executive conferences frequently suffers from fragmented, error-prone administrative workflows. Traditional approaches rely on detached spreadsheets, unvalidated web forms, and manual paper sign-in rosters.

### 1.2 Problem Statement
Key operational vulnerabilities in conventional event coordination include:
1. **Seat Overbooking & Race Conditions**: Inability to handle simultaneous bookings for limited-capacity venues, leading to physical venue overflows and credential disputes.
2. **Duplicate Registrations**: Participants registering repeatedly with identical email addresses or accounts, skewing attendee forecasting and blocking eligible peers.
3. **Privilege Escalation & Unauthorized Access**: Vulnerable public registration forms that allow malicious actors to elevate their accounts to administrator levels.
4. **Attendance Fraud & Gate Delays**: Lack of cryptographically unique, tamper-resistant ticket passes, enabling ticket reuse and manual check-in friction.
5. **Absence of Real-Time Intelligence**: Event managers lack live visibility into registration velocity, attendance conversion ratios, and capacity utilization.

### 1.3 Project Scope
**StratosEvent** delivers a secure, full-stack, enterprise-grade event management platform. It encompasses public event discovery, atomic seat reservation protected by transactional row locking (`SELECT ... FOR UPDATE`), role-based authorization (RBAC), gate check-in scanners with duplicate entry guards, and a real-time executive analytics engine.

---

## 2. Stakeholders & User Roles

| Persona | Role Key | Core System Capabilities & Access Scope |
| :--- | :--- | :--- |
| **Anonymous Visitor** | `public` | Browse published catalog, filter events by category, search by keywords, view live availability indicators, access login/register modal. |
| **Participant** | `participant` | Self-register accounts (forced `participant` role), log in with JWT generation, book open event seats, view personal registration history, cancel bookings to release seats. |
| **Event Administrator** | `admin` | Full administrative control: create, edit, publish, and complete events; inspect attendee rosters; approve/reject registrations; scan and verify admission ticket passes; access real-time analytics; export CSV rosters. |
| **System Evaluator** | `auditor` | Inspect technical guarantees, verify database relational integrity, review automated test suites (35 unit tests, 26 E2E tests). |

---

## 3. Functional Requirements (FR)

### FR-01: User Authentication & Role-Based Access Control (RBAC)
* **FR-01.1**: The system shall provide secure account registration for participants.
* **FR-01.2**: Public registration shall strictly enforce the `participant` role on the server, discarding any client-provided `role` payload to prevent privilege escalation (CWE-269 mitigation).
* **FR-01.3**: Passwords must be hashed using `bcrypt` with a salt factor of 10 prior to database storage. Plaintext passwords must never be logged or persisted.
* **FR-01.4**: Successful authentication shall return an industry-standard JSON Web Token (JWT) signed with the `HS256` cryptographic algorithm, containing `id`, `email`, and `role`.
* **FR-01.5**: Administrative endpoints shall reject unauthenticated calls with `401 Unauthorized` and non-admin tokens with `403 Forbidden`.

### FR-02: Event Scheduling & Lifecycle Management
* **FR-02.1**: Administrators shall create events with title, category (`workshop`, `webinar`, `conference`, `hackathon`, `seminar`), start time, end time, venue/meeting link, and positive seat capacity.
* **FR-02.2**: The system shall enforce date integrity such that `end_time >= start_time`.
* **FR-02.3**: Events shall transition through well-defined lifecycle states: `draft` ➔ `published` ➔ `completed` or `cancelled`.
* **FR-02.4**: Public visitors and participants shall only view events in `published` status.

### FR-03: Dynamic Event Catalog & Real-Time Availability
* **FR-03.1**: The frontend shall display events dynamically loaded from `GET /api/events`.
* **FR-03.2**: Event cards shall display live seat availability calculated as:  
  $$\text{Available Seats} = \max\left(0, \text{Capacity} - \text{Active Registrations}\right)$$
* **FR-03.3**: Real-time filtering shall support instant keyword searching (title, description, venue) and category dropdown selection.
* **FR-03.4**: Event cards shall display status pills: Green for abundant seats, Yellow warning for $\le 10$ seats, and Red `SOLD OUT` with disabled action buttons when capacity is reached.

### FR-04: Concurrency-Guarded Seat Reservation
* **FR-04.1**: Seat reservation shall execute inside an atomic MySQL database transaction with row-level locking (`SELECT ... FOR UPDATE`).
* **FR-04.2**: The system shall reject duplicate bookings by the same participant for the same event with `409 Conflict` (`DUPLICATE_REGISTRATION`), backed by composite unique constraint `uq_registrations_user_event (user_id, event_id)`.
* **FR-04.3**: When active bookings equal or exceed event capacity, the transaction shall roll back and return `409 Conflict` (`CAPACITY_REACHED`).
* **FR-04.4**: Two simultaneous requests for the last available seat must be serialized such that exactly one succeeds and the other fails safely without overbooking.

### FR-05: Cryptographic Pass Generation & Gate Check-In
* **FR-05.1**: Upon registration, the system shall generate a cryptographically unique ticket code formatted as:  
  `SE-<eventId>-<userId>-<timestamp36>-<hex4>`
* **FR-05.2**: Administrators shall verify ticket authenticity via `GET /api/attendance/verify/:ticketCode` before admitting attendees.
* **FR-05.3**: Check-in entry shall be recorded via `POST /api/attendance/check-in` with timestamp, status (`checked_in`, `late`), and gate notes.
* **FR-05.4**: Re-scanning an already-admitted ticket shall be rejected with `409 Conflict` (`DUPLICATE_CHECKIN`), backed by `uq_attendance_registration`.

### FR-06: Participant Self-Service & Cancellation
* **FR-06.1**: Authenticated participants shall view their registered passes via `GET /api/registrations/my`.
* **FR-06.2**: Participants may cancel an approved registration via `PATCH /api/registrations/:id/cancel`.
* **FR-06.3**: Cancellation must immediately release the reserved seat back into the public availability pool.

### FR-07: Executive Analytics & Reporting Engine
* **FR-07.1**: Administrators shall access aggregated system intelligence via `GET /api/analytics/overview`.
* **FR-07.2**: The analytics engine shall calculate the Attendance Confirmation Ratio:  
  $$\text{Confirmation Ratio} = \left(\frac{\text{Total Checked-In Attendees}}{\text{Total Approved Registrations}}\right) \times 100$$
* **FR-07.3**: The engine shall compute Event-Level Capacity Utilization:  
  $$\text{Capacity Utilization} = \left(\frac{\text{Active Registrations}}{\text{Venue Capacity}}\right) \times 100$$
* **FR-07.4**: Participant demographic distribution shall be aggregated strictly from collected user email domains and contact number presence.
* **FR-07.5**: The system shall stream a formatted CSV roster report via `GET /api/analytics/export/csv`.

---

## 4. Non-Functional Requirements (NFR)

### NFR-01: Security & Confidentiality
* **NFR-01.1**: Industry standard Bcrypt hashing (cost factor 10) for all passwords.
* **NFR-01.2**: JWT algorithm confusion mitigation: strictly enforce `algorithms: ['HS256']`.
* **NFR-01.3**: Production startup guard: Node.js server refuses to start if `NODE_ENV === 'production'` while `JWT_SECRET` is unset or default.
* **NFR-01.4**: Parameterized SQL queries using `mysql2/promise` to prevent SQL Injection (SQLi).
* **NFR-01.5**: Strict Cross-Origin Resource Sharing (CORS) and header sanitization.

### NFR-02: Usability & Responsive Design
* **NFR-02.1**: Fully responsive layout validated across 1400px (Desktop), 768px (Tablet), and 375px (Mobile).
* **NFR-02.2**: Zero horizontal overflow (`0px`) on all mobile viewports.
* **NFR-02.3**: Clear sensory feedback for loading spinners, empty states, and descriptive alert banners.
* **NFR-02.4**: High-contrast, thematic Stranger Things neon styling adhering to WCAG 2.1 AA legibility.

### NFR-03: Reliability & Data Integrity
* **NFR-03.1**: Relational referential integrity maintained via InnoDB engine with cascade rules (`ON DELETE CASCADE` for registrations/attendance, `ON DELETE SET NULL` for event creators).
* **NFR-03.2**: Automated test teardown hooks ensuring zero residual data accumulation and 100% preservation of original seed records.

### NFR-04: Performance & Scalability
* **NFR-04.1**: Sub-50ms API response time on indexed queries under local development workloads.
* **NFR-04.2**: Connection pooling (`mysql2.createPool`) with queue limiting to handle concurrent requests efficiently.

---

## 5. Business Rules & Validation

1. **Email Uniqueness**: Every user account must have a distinct, lowercase email address.
2. **Capacity Positivity**: Event capacity must be an integer strictly greater than zero ($C \ge 1$).
3. **Date Consistency**: `end_time` must be equal to or later than `start_time`.
4. **Single Ticket Policy**: Exactly one active registration pass per user per event.
5. **No Check-In Without Approval**: Only registrations in `approved` status are eligible for admission check-in.
6. **No Phantom Seats**: Cancelled or rejected registrations do not count against venue capacity.

---

## 6. Acceptance Criteria

| ID | Criteria | Verification Method |
| :--- | :--- | :--- |
| **AC-01** | Public registration always provisions `participant` role regardless of payload | Automated test `api.test.js` #2.4 |
| **AC-02** | Seeded admin account authenticates and receives admin JWT | Automated test `api.test.js` #2.9 |
| **AC-03** | Participant cannot call admin-only endpoints (returns 403) | Automated test `api.test.js` #3.2 |
| **AC-04** | Row-level locking prevents overbooking beyond venue capacity | Automated test `api.test.js` #5.3 |
| **AC-05** | Duplicate booking returns 409 Conflict | Automated test `api.test.js` #5.2 |
| **AC-06** | Duplicate gate check-in returns 409 Conflict | Automated test `api.test.js` #7.3 |
| **AC-07** | Analytics overview returns real computed ratios from MySQL | Automated test `api.test.js` #9.3 |
| **AC-08** | CSV export returns valid `text/csv` stream with headers | Automated test `api.test.js` #9.5 |
| **AC-09** | Responsive layout exhibits zero horizontal overflow on mobile | Visual Edge test (375x812) |
| **AC-10** | Database seed records (7 users, 5 events, 7 regs, 3 att) remain intact | Post-test SQL count audit |
