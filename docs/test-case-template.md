# StratosEvent — Functional Test Case Specification & Execution Results

**Project Name**: StratosEvent — Event Management & Registration Platform  
**Target Environment**: Node.js v24.20.0, MySQL 8.0+ (InnoDB), Google Chrome / Microsoft Edge  
**Document Status**: Fully Executed & Verified (35 Automated Tests + 26 E2E Tests Passing)  

---

## 1. Functional Test Case Template Definition

| Field | Description |
| :--- | :--- |
| **Test Case ID** | Unique hierarchical identifier (e.g., `TC-AUTH-01`, `TC-BOOK-02`). |
| **Module / Screen** | Functional area or UI screen under test. |
| **Preconditions** | Required system and database state prior to execution. |
| **Action & Input** | Specific operation, payload parameters, or user interaction. |
| **Expected Result** | Expected HTTP status code, database modification, or UI state. |
| **Actual Result** | Observed behavior during execution. |
| **Status** | `PASS`, `FAIL`, or `BLOCKED`. |
| **Evidence / Remarks** | Associated automated test assertion, log output, or error code. |

---

## 2. Executed Functional Test Cases

### Module 1: Authentication & Privilege Escalation Mitigation

| Test Case ID | Screen / Module | Preconditions | Action & Input | Expected Result | Actual Result | Status | Evidence / Remarks |
| :--- | :--- | :--- | :--- | :--- | :--- | :---: | :--- |
| **TC-AUTH-01** | User Registration | Server UP | Submit registration with invalid email `notanemail` | HTTP 400 with `VALIDATION_ERROR` details | HTTP 400 Bad Request returned with validation array | **PASS** | `api.test.js` #2.1 |
| **TC-AUTH-02** | User Registration | Valid new email | Submit valid participant payload (`full_name`, `email`, `password`) | HTTP 201 Created; returns signed JWT and `user.role: 'participant'` | HTTP 201; JWT token received; role is participant | **PASS** | `api.test.js` #2.2 |
| **TC-AUTH-03** | User Registration | Existing user | Submit registration with existing email | HTTP 409 Conflict (`EMAIL_ALREADY_EXISTS`) | HTTP 409 Conflict returned with descriptive message | **PASS** | `api.test.js` #2.3 |
| **TC-AUTH-04** | Security / Privilege Guard | Public endpoint | Submit registration with payload `{ role: "admin" }` | HTTP 201; server **ignores** role payload and strictly forces `user.role: 'participant'` | HTTP 201; DB stores role 'participant'; token fails admin routes with 403 | **PASS** | `api.test.js` #2.4 (CWE-269 Mitigation) |
| **TC-AUTH-05** | Security / Privilege Guard | Public endpoint | Submit registration with arbitrary role `{ role: "administrator" }` | HTTP 201; server assigns `participant` | HTTP 201; role assigned is 'participant' | **PASS** | `api.test.js` #2.5 |
| **TC-AUTH-06** | User Authentication | Registered user | Submit valid email and correct password | HTTP 200 OK; returns signed JWT token | HTTP 200 OK; JWT token generated | **PASS** | `api.test.js` #2.7 |
| **TC-AUTH-07** | User Authentication | Registered user | Submit valid email with incorrect password | HTTP 401 Unauthorized (`INVALID_CREDENTIALS`) | HTTP 401 Unauthorized returned | **PASS** | `api.test.js` #2.8 |
| **TC-AUTH-08** | Seeded Admin Auth | Seed records in DB | Submit `admin@stratosevent.internal` & `StratosDev@2026` | HTTP 200 OK; returns JWT with `role: 'admin'` | HTTP 200 OK; admin privileges granted | **PASS** | `api.test.js` #2.9 |
| **TC-AUTH-09** | Profile Retrieval | Valid JWT token | GET `/api/auth/me` with Bearer token | HTTP 200 OK; returns authenticated profile | HTTP 200 OK; returned profile matches token | **PASS** | `api.test.js` #2.10 |

---

### Module 2: Role-Based Access Control (RBAC) & Tampering Prevention

| Test Case ID | Screen / Module | Preconditions | Action & Input | Expected Result | Actual Result | Status | Evidence / Remarks |
| :--- | :--- | :--- | :--- | :--- | :--- | :---: | :--- |
| **TC-RBAC-01** | Admin Endpoints | No token | POST `/api/events` without Authorization header | HTTP 401 Unauthorized (`AUTH_TOKEN_REQUIRED`) | HTTP 401 Unauthorized returned | **PASS** | `api.test.js` #3.1 |
| **TC-RBAC-02** | Admin Endpoints | Participant JWT | POST `/api/events` with participant token | HTTP 403 Forbidden (`FORBIDDEN`) | HTTP 403 Forbidden returned | **PASS** | `api.test.js` #3.2 |
| **TC-RBAC-03** | Security / Payload Tamper | Participant JWT | POST `/api/events` with `{ role: "admin" }` in payload body | HTTP 403 Forbidden; request body tampering cannot bypass server RBAC | HTTP 403 Forbidden; role extracted strictly from verified JWT | **PASS** | `api.test.js` #3.3 |

---

### Module 3: Event Management & Catalog Discovery

| Test Case ID | Screen / Module | Preconditions | Action & Input | Expected Result | Actual Result | Status | Evidence / Remarks |
| :--- | :--- | :--- | :--- | :--- | :--- | :---: | :--- |
| **TC-EVT-01** | Event Creation | Admin JWT | POST `/api/events` with valid event details (capacity: 1) | HTTP 201 Created; event stored in MySQL | HTTP 201 Created; event ID assigned | **PASS** | `api.test.js` #4.1 |
| **TC-EVT-02** | Catalog Retrieval | Events in DB | GET `/api/events` | HTTP 200 OK; returns list of published events with calculated available seats | HTTP 200 OK; returned 4 published seed events | **PASS** | `api.test.js` #4.2 |
| **TC-EVT-03** | Keyword Search | Catalog loaded | GET `/api/events?search=Kubernetes` | Returns matching Kubernetes event | Returned event #1 | **PASS** | `e2e_verification.js` Test 1 |
| **TC-EVT-04** | Category Filter | Catalog loaded | GET `/api/events?event_type=hackathon` | Returns only hackathon events | Returned event #3 | **PASS** | `e2e_verification.js` Test 1 |
| **TC-EVT-05** | Event Update | Admin JWT | PUT `/api/events/:id` updating venue and description | HTTP 200 OK; updated record returned | HTTP 200 OK; venue updated | **PASS** | `api.test.js` #4.3 |
| **TC-EVT-06** | Event Archiving | Admin JWT | PATCH `/api/events/:id/status` `{ status: "completed" }` | HTTP 200 OK; status set to completed | HTTP 200 OK; status updated | **PASS** | `api.test.js` #8.1 |

---

### Module 4: Concurrency-Safe Booking & Capacity Protection

| Test Case ID | Screen / Module | Preconditions | Action & Input | Expected Result | Actual Result | Status | Evidence / Remarks |
| :--- | :--- | :--- | :--- | :--- | :--- | :---: | :--- |
| **TC-BOOK-01** | Seat Reservation | Open capacity | Participant 1 calls POST `/api/registrations` `{ event_id: testId }` | HTTP 201 Created; generates ticket code `SE-...` | HTTP 201 Created; ticket code generated | **PASS** | `api.test.js` #5.1 |
| **TC-BOOK-02** | Duplicate Prevention | Already registered | Participant 1 calls POST `/api/registrations` for same event | HTTP 409 Conflict (`DUPLICATE_REGISTRATION`) | HTTP 409 Conflict returned | **PASS** | `api.test.js` #5.2 |
| **TC-BOOK-03** | Capacity Guard | Capacity = 1 filled | Participant 2 attempts to book the filled event | HTTP 409 Conflict (`CAPACITY_REACHED`) | HTTP 409 Conflict returned; transaction rolled back | **PASS** | `api.test.js` #5.3 |
| **TC-BOOK-04** | Booking History | User has pass | GET `/api/registrations/my` with participant token | HTTP 200 OK; returns list containing ticket pass | HTTP 200 OK; pass found in history | **PASS** | `api.test.js` #5.4 |
| **TC-BOOK-05** | Self Cancellation | Active booking | PATCH `/api/registrations/:id/cancel` | HTTP 200 OK; status set to `cancelled`; seat released | HTTP 200 OK; seat released | **PASS** | `e2e_verification.js` Test 6 |

---

### Module 5: Gate Ticket Inspection & Attendance Check-In

| Test Case ID | Screen / Module | Preconditions | Action & Input | Expected Result | Actual Result | Status | Evidence / Remarks |
| :--- | :--- | :--- | :--- | :--- | :--- | :---: | :--- |
| **TC-GATE-01** | Ticket Pre-Verification | Valid pass issued | Admin calls GET `/api/attendance/verify/:code` | HTTP 200 OK; returns `can_check_in: true` | HTTP 200 OK; ticket verified | **PASS** | `api.test.js` #7.1 |
| **TC-GATE-02** | Attendance Check-In | Approved pass | Admin calls POST `/api/attendance/check-in` | HTTP 201 Created; attendance recorded | HTTP 201 Created; timestamp logged | **PASS** | `api.test.js` #7.2 |
| **TC-GATE-03** | Duplicate Check-In | Already checked in | Admin calls POST `/api/attendance/check-in` with same code | HTTP 409 Conflict (`DUPLICATE_CHECKIN`) | HTTP 409 Conflict returned; duplicate entry alert | **PASS** | `api.test.js` #7.3 |
| **TC-GATE-04** | Event Attendance Roster | Check-ins recorded | Admin calls GET `/api/attendance/event/:id` | HTTP 200 OK; returns roster and attendance percentage | HTTP 200 OK; metrics returned | **PASS** | `api.test.js` #7.4 |

---

### Module 6: Executive Analytics & Business Intelligence

| Test Case ID | Screen / Module | Preconditions | Action & Input | Expected Result | Actual Result | Status | Evidence / Remarks |
| :--- | :--- | :--- | :--- | :--- | :--- | :---: | :--- |
| **TC-ANL-01** | Analytics Auth Guard | No token | GET `/api/analytics/overview` | HTTP 401 Unauthorized | HTTP 401 returned | **PASS** | `api.test.js` #9.1 |
| **TC-ANL-02** | Analytics Role Guard | Participant token | GET `/api/analytics/overview` | HTTP 403 Forbidden | HTTP 403 returned | **PASS** | `api.test.js` #9.2 |
| **TC-ANL-03** | Executive Intelligence | Admin token | GET `/api/analytics/overview` | HTTP 200 OK; returns aggregated event counts, confirmation ratios, demographics | HTTP 200 OK; 50.0% confirmation ratio, 100% phone coverage | **PASS** | `api.test.js` #9.3 |
| **TC-ANL-04** | Event Performance | Admin token | GET `/api/analytics/events` | HTTP 200 OK; returns event-wise capacity utilization and attendance rates | HTTP 200 OK; 5 events evaluated | **PASS** | `api.test.js` #9.4 |
| **TC-ANL-05** | CSV Roster Export | Admin token | GET `/api/analytics/export/csv` | HTTP 200 OK; Content-Type: `text/csv; charset=utf-8`; contains valid CSV rows | HTTP 200 OK; 2318+ bytes CSV streamed | **PASS** | `api.test.js` #9.5 |
