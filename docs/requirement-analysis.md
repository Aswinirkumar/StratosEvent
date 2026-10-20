# StratosEvent — Requirement Analysis & Feature Mapping
**TCS iON Industry Project: Event Management and Registration Platform**

---

## 1. Executive Summary
**StratosEvent** is an industry-grade, full-stack web application developed under the TCS iON framework. It simplifies corporate and campus event coordination by providing a centralized platform for scheduling, registering, and tracking attendance for workshops, webinars, hackathons, and conferences.

The system addresses critical operational challenges such as overbooking, duplicate registrations, attendance fraud, and manual tracking inefficiencies.

---

## 2. User Roles & Personas

| Role | Description | Core Responsibilities |
| :--- | :--- | :--- |
| **Participant** | Student, employee, or external attendee. | Discover events, register, receive confirmation ticket passes, view registration history, and check in. |
| **Administrator** | Event coordinator, organizer, or campus authority. | Create & manage events, set capacity thresholds, approve/reject registrations, record attendee check-ins, and export reports. |

---

## 3. Functional Requirements (FR) & Feature Mapping

### FR-01: User Management & Authentication
* **Requirement**: Provide secure user registration, login, and profile management with distinct roles (Participant vs. Admin).
* **Planned Feature**:
  - Secure credential storage using bcrypt hashing.
  - Role-based access control (RBAC) separating administrative actions from standard participant access.
  - Session/token authentication via Express middleware.
* **Database Entity**: `users` (fields: `email`, `password_hash`, `role`, `full_name`, `phone_number`).

---

### FR-02: Event Lifecycle & Publishing
* **Requirement**: Enable administrators to create, update, publish, cancel, and archive events.
* **Planned Feature**:
  - Event creation form with title, rich description, event type (`workshop`, `webinar`, `conference`, `hackathon`, `seminar`), start/end times, venue/meeting link, and seat capacity.
  - Lifecycle states: `draft` ➔ `published` ➔ `completed` or `cancelled`.
  - Date validation enforcing `end_time >= start_time`.
* **Database Entity**: `events` (fields: `title`, `event_type`, `start_time`, `end_time`, `venue`, `capacity`, `status`, `created_by`).

---

### FR-03: Event Discovery & Search
* **Requirement**: Participants need an intuitive way to explore and filter available events.
* **Planned Feature**:
  - Responsive event catalog built with Bootstrap 5 cards.
  - Live filtering by event type, date range, and keyword search.
  - Real-time display of remaining available seats.
* **Database Queries**: Indexed lookups on `events.status`, `events.start_time`, and `events.event_type`.

---

### FR-04: Event Registration & Seat Limiting
* **Requirement**: Allow participants to register while strictly preventing duplicate registrations and seat overflow.
* **Planned Feature**:
  - **Duplicate Prevention**: A user cannot register for the same event multiple times. Guaranteed at the database level via a composite unique key: `UNIQUE(user_id, event_id)`.
  - **Seat Limit Enforcement**: Backend checks available seats within an atomic database transaction (`SELECT capacity FROM events WHERE id = ? FOR UPDATE`) before confirming registration.
  - **Ticket Code Generation**: Assigns an alphanumeric unique code (e.g., `TKT-STR-2026-0001`) upon confirmation for QR/barcode generation.
* **Database Entity**: `registrations` (fields: `user_id`, `event_id`, `ticket_code`, `status`, `registration_date`).

---

### FR-05: Attendance Check-in & Verification
* **Requirement**: Enable event staff to verify attendees on event day and eliminate duplicate check-ins.
* **Planned Feature**:
  - Fast check-in interface for admins to enter or scan ticket codes.
  - **Duplicate Check-in Prevention**: Enforced at the database level with `UNIQUE(registration_id)` in the `attendance` table. Attempting to check in a ticket twice returns an explicit error.
  - Record check-in timestamp and attendance status (`checked_in`, `absent`, `late`).
* **Database Entity**: `attendance` (fields: `registration_id`, `check_in_time`, `check_in_status`, `verified_by`, `notes`).

---

### FR-06: Dashboards & Reporting
* **Requirement**: Provide visibility into registrations and event performance.
* **Planned Feature**:
  - **Participant Dashboard**: List of registered events with status badges (`approved`, `pending`, `cancelled`) and downloadable ticket passes.
  - **Admin Dashboard**: Event overview, real-time registration counts, capacity utilization percentages, and attendee roster lists.

---

## 4. Requirements Traceability Matrix (RTM)

| TCS iON Requirement | System Feature | Database Table(s) | Planned Backend API | Planned Frontend View |
| :--- | :--- | :--- | :--- | :--- |
| User sign up & role distinction | Auth Module & Profile | `users` | `POST /api/auth/register`<br>`POST /api/auth/login` | `login.html`<br>`register.html` |
| Event scheduling & capacity limits | Event Management | `events`, `users` | `POST /api/events`<br>`GET /api/events`<br>`PUT /api/events/:id` | `admin-events.html`<br>`events.html` |
| Participant registration | Booking Engine | `registrations`, `events` | `POST /api/registrations`<br>`GET /api/registrations/my` | `event-details.html`<br>`my-tickets.html` |
| Duplicate registration prevention | Uniqueness Constraint | `registrations` (`uq_registrations_user_event`) | Error handler for MySQL `ER_DUP_ENTRY` (1062) | Alert modal: "Already Registered" |
| Capacity enforcement | Transactional validation | `events`, `registrations` | Handled inside `POST /api/registrations` using DB transaction | Alert badge: "Sold Out / Capacity Full" |
| Event check-in & duplicate guard | Attendance Module | `attendance`, `registrations` | `POST /api/attendance/check-in`<br>`GET /api/attendance/:eventId` | `admin-checkin.html` |

---

## 5. Non-Functional Requirements (NFR)

1. **Data Integrity**: Enforced via InnoDB engine with foreign keys (`ON DELETE CASCADE` / `ON DELETE SET NULL`) and constraint checks (`capacity > 0`, `end_time >= start_time`).
2. **Security**: 
   - Passwords stored strictly as one-way Bcrypt hashes.
   - SQL injection prevention through parameterized queries (`mysql2` prepared statements).
   - Input sanitization and cross-site scripting (XSS) prevention on forms.
3. **Usability**: Responsive, mobile-first design using Bootstrap 5 to accommodate both desktop and mobile users.
4. **Reliability & Concurrency**: Atomic transactions during registration to guarantee that high-concurrency requests do not exceed the event seat capacity.
