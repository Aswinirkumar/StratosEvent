# StratosEvent — Requirements Traceability Matrix (RTM)

**Project Name**: StratosEvent — Enterprise Event Management & Registration Platform  
**Target Architecture**: Node.js (Express), MySQL 8.0+ (InnoDB), HTML5/CSS3/JavaScript (Bootstrap 5)  
**Security Standard**: Bcrypt Hashing, JWT (HS256) RBAC, Transactional Concurrency Control (`SELECT ... FOR UPDATE`)  
**Audit Date**: October 20, 2026  
**Status Legend**:  
- `VERIFIED_COMPLETE`: Inspected in source code, automated test passing, live runtime verified.  
- `PARTIALLY_COMPLETE`: Backend or frontend functional, but missing full integration or reporting.  
- `MISSING`: Requirement not yet implemented in codebase.  
- `UNVERIFIED`: Code exists but requires manual runtime verification or explicit approval.  
- `REQUIRES_USER_APPROVAL`: Operation involving production deployment or database schema migration.

---

## 1. Section A: Official Project Objectives

| Req ID | Objective Description | Related Source Files & Endpoints | Current Status | Verification Evidence | Identified Gap & Corrective Action | Manual Check Req? |
| :--- | :--- | :--- | :--- | :--- | :--- | :---: |
| **OBJ-01** | Create & manage events (schedule, venue, capacity, resources) | `backend/routes/events.js`<br>`frontend/js/main.js`<br>`frontend/index.html`<br>`POST /api/events`<br>`PUT /api/events/:id`<br>`PATCH /api/events/:id/status` | `VERIFIED_COMPLETE` | `api.test.js` tests 4.1-4.3 passing. UI modal supports event title, category, date-time, venue, capacity. Form updates MySQL live. | None. Fully functional. | No |
| **OBJ-02** | Participant event discovery & validated registration | `backend/routes/events.js`<br>`backend/routes/registrations.js`<br>`frontend/js/main.js`<br>`GET /api/events`<br>`POST /api/registrations` | `VERIFIED_COMPLETE` | `e2e_verification.js` tests 1-4 passing. Validated inputs (`full_name`, `email`, `password`, `capacity`). Live seat calculation displayed. | None. Fully functional. | No |
| **OBJ-03** | Support ticket tiers or registration categories | `database/schema.sql`<br>`backend/routes/registrations.js`<br>`frontend/index.html` | `PARTIALLY_COMPLETE` | `events.event_type` exists ('workshop', 'webinar', 'conference', 'hackathon', 'seminar'). | Schema lacks explicit `ticket_tier` attribute on registration. Safe non-destructive migration proposed in Milestone 1. | Yes (Approval) |
| **OBJ-04** | Registration approval workflows for exclusive events | `backend/routes/registrations.js`<br>`frontend/js/main.js`<br>`PATCH /api/registrations/:id/status` | `VERIFIED_COMPLETE` | Status enum supports `'pending'`, `'approved'`, `'rejected'`, `'cancelled'`. Admin console allows 1-click approval/rejection. | Hackathon/conference events should default to `pending` for exclusive moderation. | No |
| **OBJ-05** | Track lifecycle: Registered ➔ Approved/Rejected ➔ Checked-in | `backend/routes/registrations.js`<br>`backend/routes/attendance.js`<br>`frontend/index.html` (`#workflowSection`) | `VERIFIED_COMPLETE` | Full 4-stage pipeline implemented in DB and verified by `api.test.js` tests 5.1-7.4. UI displays verified pass badges. | None. Fully functional. | No |
| **OBJ-06** | Prevent duplicate bookings and overbooking | `backend/routes/registrations.js`<br>`database/schema.sql` (`uq_registrations_user_event`) | `VERIFIED_COMPLETE` | Atomic transaction `SELECT ... FOR UPDATE` with `ER_DUP_ENTRY` handling. `api.test.js` test 5.2 & 5.3 passing. | None. Fully functional. | No |
| **OBJ-07** | Real-time seat availability and attendance info | `backend/routes/events.js`<br>`backend/routes/attendance.js`<br>`frontend/js/main.js` | `VERIFIED_COMPLETE` | Dynamic SQL aggregation `GREATEST(0, capacity - count)`. UI displays dynamic pill badges (`57 / 60 FREE`, `10 SEATS LEFT`, `SOLD OUT`). | None. Fully functional. | No |
| **OBJ-08** | Analytics & reporting dashboard (trends, ratios, demographics) | `backend/routes/analytics.js`<br>`frontend/js/main.js`<br>`frontend/index.html` | `VERIFIED_COMPLETE` | Endpoints `GET /api/analytics/overview`, `GET /api/analytics/events`, and `GET /api/analytics/export/csv` verified. Tab 4 added to Admin Modal with live KPI metrics, utilization table, and CSV download. | Fully implemented & verified. | No |
| **OBJ-09** | Professional administration & eliminate spreadsheets | `frontend/index.html`<br>`frontend/js/main.js`<br>`#adminConsoleModal` | `VERIFIED_COMPLETE` | Interactive Hawkins Admin Console handles roster review, gate scanner, and live publishing. | Add CSV export to analytics to provide automated spreadsheet exports. | No |
| **OBJ-10** | Tested, secure, responsive, and deployable app | `backend/tests/api.test.js`<br>`backend/tests/e2e_verification.js`<br>`frontend/css/style.css` | `VERIFIED_COMPLETE` | 30/30 backend unit tests passing. 24/24 E2E tests passing. 0px overflow on mobile (375px) and desktop (1400px). | Deployment to external cloud is held pending user approval (Req J). | Yes (Approval) |

---

## 2. Section B & C: Milestone 1 — Workflow & Data Architecture

| Req ID | Requirement Description | Related Files | Status | Evidence / Verification | Gap & Action Plan |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **M1-01** | Software Requirements Specification (SRS) | `docs/SRS.md` | `VERIFIED_COMPLETE` | Complete formal SRS covering problem statement, user roles, FR-01 through FR-07, NFR-01 through NFR-04, assumptions, and acceptance criteria. | Fully authored & verified. |
| **M1-02** | System Flow Diagrams (7 core flows) | `docs/system-flow-diagrams.md` | `VERIFIED_COMPLETE` | 7 detailed Mermaid sequence diagrams covering user auth, event discovery, concurrent booking locking, moderation, gate check-in, duplicate prevention, and analytics CSV export. | Fully authored & verified. |
| **M1-03** | Entity-Relationship Diagram (ERD) | `docs/erd.md`<br>`database/schema.sql` | `VERIFIED_COMPLETE` | Verified against MySQL schema: 4 tables, PKs, FKs, cascade rules, indexes. | Update ERD with proposed ticket tier extension. |
| **M1-04** | Database Integrity & Seed Data Preservation | `database/schema.sql`<br>`database/seed.sql` | `VERIFIED_COMPLETE` | Automated test teardown hook preserves exact seed counts: 7 users, 5 events, 7 registrations, 3 attendance records. | Ensure no table-drop statements are ever executed against active development database. |

---

## 3. Section D: Milestone 2 — UI Development & Event Listing

| Req ID | Requirement Description | Related Files | Status | Evidence / Verification | Gap & Action Plan |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **M2-01** | Participant Portal: Event Discovery & Filter | `frontend/index.html`<br>`frontend/js/main.js` | `VERIFIED_COMPLETE` | Keyword search input and category dropdown filter dynamically in client & sync with backend. | Fully verified. |
| **M2-02** | Participant Portal: Registration & Pass Modal | `frontend/index.html`<br>`frontend/js/main.js` | `VERIFIED_COMPLETE` | Verified ticket pass modal (#ticketModal) renders unique cryptographic code upon booking. | Fully verified. |
| **M2-03** | Participant Portal: Booking History & Cancel | `frontend/index.html`<br>`frontend/js/main.js` | `VERIFIED_COMPLETE` | #myBookingsModal fetches `/api/registrations/my` and provides 1-click self-cancellation. | Fully verified. |
| **M2-04** | Administrator Interface: Console & Moderation | `frontend/index.html`<br>`frontend/js/main.js` | `VERIFIED_COMPLETE` | #adminConsoleModal supports registration approvals, gate ticket scanner, and event publishing. | Integrate Analytics & Reporting tab. |
| **M2-05** | Responsive Layout & Zero Overflow | `frontend/css/style.css` | `VERIFIED_COMPLETE` | Headless Edge captures at 1400x900 and 375x812 show 0px horizontal overflow, fluid typography, collapsed drawer. | Fully verified. |
| **M2-06** | Honest Data Representation (No False Live Data) | `frontend/js/main.js` | `VERIFIED_COMPLETE` | UI explicitly distinguishes between live MySQL connection (`Live MySQL Database Connected`) and offline fallback. | Fully verified. |

---

## 4. Section E: Milestone 3 — Registration Engine & Admin Control

| Req ID | Requirement Description | Related Files | Status | Evidence / Verification | Gap & Action Plan |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **M3-01** | Secure Authentication & Password Hashing | `backend/routes/auth.js`<br>`backend/middleware/auth.js` | `VERIFIED_COMPLETE` | Bcrypt with 10 salt rounds. JWT HS256 algorithm enforcement. | Fully verified. |
| **M3-02** | Privilege Escalation Guard | `backend/routes/auth.js`<br>`backend/middleware/validator.js` | `VERIFIED_COMPLETE` | Server forces `role: 'participant'` on public registration, ignoring client payload. Tests verify 403 on admin routes. | Fully verified. |
| **M3-03** | Row-Level Locking & Capacity Guard | `backend/routes/registrations.js` | `VERIFIED_COMPLETE` | Atomic transaction with `SELECT ... FOR UPDATE` prevents overbooking on concurrent requests. | Fully verified. |
| **M3-04** | Cryptographic Ticket Issuance & Verification | `backend/routes/attendance.js`<br>`backend/routes/registrations.js` | `VERIFIED_COMPLETE` | Alphanumeric tokens generated via `crypto.randomBytes`. Pre-verification endpoint `/attendance/verify/:code`. | Fully verified. |
| **M3-05** | Duplicate Check-In Prevention | `backend/routes/attendance.js`<br>`database/schema.sql` | `VERIFIED_COMPLETE` | Database unique constraint `uq_attendance_registration` and API check return 409 Conflict. | Fully verified. |
| **M3-06** | Ticket Tiers Model Support | `database/migrations/` *(pending)* | `PARTIALLY_COMPLETE` | Supported conceptually via category. Needs safe migration file for tier column. | Create safe migration file `database/migrations/001_add_ticket_tiers.sql`. |

---

## 5. Section F: Analytics & Reporting Dashboard

| Req ID | Requirement Description | Related Files | Status | Evidence / Verification | Gap & Action Plan |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **AN-01** | Total Events & Status Aggregations | `backend/routes/analytics.js` | `VERIFIED_COMPLETE` | `GET /api/analytics/overview` returns live counts for `published`, `draft`, `completed`, `cancelled`. Automated tests pass. | Fully functional. |
| **AN-02** | Registration Trends & Status Breakdown | `backend/routes/analytics.js` | `VERIFIED_COMPLETE` | `GET /api/analytics/overview` aggregates `approved`, `pending`, `rejected`, `cancelled` registrations. | Fully functional. |
| **AN-03** | Attendance Rate & Check-In Ratio | `backend/routes/analytics.js` | `VERIFIED_COMPLETE` | Calculates `(checked_in / approved_registrations) * 100` (e.g. 50.0%). Verified via unit tests. | Fully functional. |
| **AN-04** | Event-Level Capacity & Utilization | `backend/routes/analytics.js` | `VERIFIED_COMPLETE` | `GET /api/analytics/events` computes per-event utilization `%`, active seats, and attendance rates. | Fully functional. |
| **AN-05** | Participant Demographics (Collected Data) | `backend/routes/analytics.js` | `VERIFIED_COMPLETE` | Computes email domain breakdown and phone presence ratio from actual database records. | Fully functional. |
| **AN-06** | CSV Export for Authorized Admin Reports | `backend/routes/analytics.js` | `VERIFIED_COMPLETE` | `GET /api/analytics/export/csv` generates and streams RFC 4180-compliant CSV roster. Verified with admin token. | Fully functional. |
| **AN-07** | Admin Console UI Analytics Tab | `frontend/index.html`<br>`frontend/js/main.js` | `VERIFIED_COMPLETE` | Tab 4 renders 4 KPI metric cards, capacity utilization progress bars, demographics, and CSV download button. | Fully functional. |

---

## 6. Section G & H: Testing & Deliverable Templates

| Req ID | Requirement Description | Related Files | Status | Evidence / Verification | Gap & Action Plan |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TST-01** | Automated Backend Test Suite | `backend/tests/api.test.js` | `VERIFIED_COMPLETE` | 35 tests passing across 9 suites in 1.46s. Automated teardown hook guarantees 100% sample data preservation. | Fully functional. |
| **TST-02** | End-to-End Verification Suite | `backend/tests/e2e_verification.js` | `VERIFIED_COMPLETE` | 26 tests passing covering registration, login, booking, approval, gate check-in, duplicate checks, and analytics. | Fully functional. |
| **DOC-01** | UI Wireframes | `docs/wireframes.md` | `VERIFIED_COMPLETE` | Structured wireframe specifications for all 8 application screens with layout grids and controls. | Fully authored. |
| **DOC-02** | Functional Test Case Template | `docs/test-case-template.md` | `VERIFIED_COMPLETE` | Standardized test case template and log of all 26 verified operational test runs. | Fully authored. |
| **DOC-03** | API Documentation | `docs/api-documentation.md` | `VERIFIED_COMPLETE` | Complete API reference including Auth, Events, Registrations, Attendance, and Analytics endpoints. | Fully updated. |
| **DOC-04** | Deployment Checklist & Smoke Tests | `docs/deployment-checklist.md` | `VERIFIED_COMPLETE` | Comprehensive pre-deployment checklist, environment variables, smoke tests, and rollback procedures. | Fully authored. |
| **DOC-05** | Technical Manual & Windows VS Code Guide | `docs/technical-manual.md` | `VERIFIED_COMPLETE` | System architecture, Windows setup, VS Code integration (launch/tasks), troubleshooting, and concurrency details. | Fully authored. |
| **DOC-06** | Professional Project Report (PDF/Doc) | `docs/project-report.md` | `VERIFIED_COMPLETE` | Comprehensive academic and industry final project report covering all 10 objectives and system analysis. | Fully authored. |

---

## 7. Section I & J: Environment & Deployment Readiness

| Req ID | Requirement Description | Related Files | Status | Evidence / Verification | Gap & Action Plan |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **ENV-01** | Windows VS Code Configuration | `.vscode/launch.json`<br>`.vscode/tasks.json` | `VERIFIED_COMPLETE` | Launch configs for F5 debugging of server and tests; tasks for running backend, frontend, unit tests, and E2E tests. | Fully verified. |
| **ENV-02** | Secrets Protection & Root `.gitignore` | `.gitignore`<br>`backend/.env.example` | `VERIFIED_COMPLETE` | Root `.gitignore` excludes `.env`, `backend/.env`, logs, `node_modules`. | Fully verified. |
| **DEP-01** | Cloud Deployment Readiness Audit | `docs/deployment-checklist.md` | `VERIFIED_COMPLETE` | Architecture audited for cloud/Linux deployment; smoke test plan and rollback documented. Ready for deployment when approved. | Deployment held pending user request. |
