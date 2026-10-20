# StratosEvent — REST API Documentation

Comprehensive technical reference for the **StratosEvent** backend REST API.

---

## 📌 1. API Architecture & Standards

- **Base URL**: `http://localhost:5000`
- **Content Type**: `application/json`
- **Authentication**: JWT Bearer Token (`Authorization: Bearer <token>`)
- **Password Security**: Bcrypt with salt factor 10
- **Database Engine**: MySQL 8.0+ (InnoDB with transactional locking)
- **Error Standard**: All errors return consistent JSON:
  ```json
  {
    "success": false,
    "error": {
      "code": "ERROR_CODE_NAME",
      "message": "Human readable description",
      "details": []
    }
  }
  ```

---

## 🔐 2. Roles & Access Control

| Role | Permissions |
| :--- | :--- |
| **Public / Unauthenticated** | View published events (`GET /api/events`), health checks, register (`POST /api/auth/register`), and login (`POST /api/auth/login`). |
| **Participant** | Register for events, cancel own bookings, view personal registered tickets (`GET /api/registrations/my`), update profile. |
| **Admin** | Create, edit, and archive events; view all registrations; approve/reject registration passes; scan and record attendance check-ins; export rosters. |

---

## 📡 3. Endpoint Reference

### 3.1 System & Health Checks

#### `GET /api/health`
Checks API readiness and live MySQL connection status.
* **Access**: Public
* **Response (200 OK)**:
  ```json
  {
    "status": "UP",
    "service": "StratosEvent Backend API",
    "environment": "development",
    "timestamp": "2026-10-19T13:00:00.000Z",
    "database": {
      "status": "connected",
      "detail": "Successfully established connection to MySQL database."
    }
  }
  ```

---

### 3.2 Authentication (`/api/auth`)

#### `POST /api/auth/register`
Creates a new participant account.
* **Access**: Public
* **Security Guard (CWE-269 Mitigation)**: Any `role` field supplied in the request body is strictly ignored; public registration unconditionally assigns `participant`. Administrator accounts cannot be created publicly.
* **Request Body**:
  ```json
  {
    "full_name": "Jane Doe",
    "email": "jane.doe@example.com",
    "password": "SecurePassword@123",
    "phone_number": "+91-98765-43210"
  }
  ```
* **Response (201 Created)**:
  ```json
  {
    "success": true,
    "message": "User registered successfully.",
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": 8,
      "full_name": "Jane Doe",
      "email": "jane.doe@example.com",
      "role": "participant",
      "phone_number": "+91-98765-43210"
    }
  }
  ```

#### `POST /api/auth/login`
Authenticates user and returns a signed JWT token.
* **Access**: Public
* **Request Body**:
  ```json
  {
    "email": "jane.doe@example.com",
    "password": "SecurePassword@123"
  }
  ```
* **Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Login successful.",
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": 8,
      "full_name": "Jane Doe",
      "email": "jane.doe@example.com",
      "role": "participant"
    }
  }
  ```

#### `GET /api/auth/me`
Fetches authenticated user profile.
* **Access**: Authenticated (Bearer Token)
* **Response (200 OK)**: Returns profile record.

---

### 3.3 Event Management (`/api/events`)

#### `GET /api/events`
Lists events with computed active registration counts and real-time available seats.
* **Access**: Public (defaults to published events) / Admin (sees all statuses)
* **Query Parameters**:
  - `status`: `draft`, `published`, `completed`, `cancelled`
  - `event_type`: `workshop`, `webinar`, `conference`, `hackathon`, `seminar`
  - `search`: Keyword search matching title or description
* **Response (200 OK)**:
  ```json
  {
    "success": true,
    "count": 5,
    "events": [
      {
        "id": 1,
        "title": "Cloud Architecture Summit",
        "event_type": "conference",
        "start_time": "2026-11-15T09:00:00.000Z",
        "end_time": "2026-11-15T17:00:00.000Z",
        "venue": "Convention Center Hall A",
        "capacity": 100,
        "status": "published",
        "registered_count": 42,
        "available_seats": 58
      }
    ]
  }
  ```

#### `POST /api/events`
Creates a new event.
* **Access**: Admin only
* **Request Body**:
  ```json
  {
    "title": "Full-Stack Web Dev Workshop",
    "description": "Hands-on workshop covering Node.js, MySQL, and Bootstrap 5.",
    "event_type": "workshop",
    "start_time": "2026-11-20 10:00:00",
    "end_time": "2026-11-20 16:00:00",
    "venue": "Computer Lab 3",
    "capacity": 50,
    "status": "published"
  }
  ```
* **Response (201 Created)**: Returns created event.

#### `PUT /api/events/:id`
Updates an existing event.
* **Access**: Admin only

#### `PATCH /api/events/:id/status`
Archives or transitions event lifecycle status (`draft`, `published`, `completed`, `cancelled`).
* **Access**: Admin only

#### `DELETE /api/events/:id`
Safely archives an event to `cancelled` if participants are registered, or hard-deletes if empty (or `?force=true`).
* **Access**: Admin only

---

### 3.4 Registrations & Ticketing (`/api/registrations`)

#### `POST /api/registrations`
Registers the authenticated participant for an event.
* **Access**: Authenticated (`participant` or `admin`)
* **Request Body**:
  ```json
  {
    "event_id": 1
  }
  ```
* **Protection Mechanisms**:
  1. Row-level transaction lock (`SELECT ... FOR UPDATE`) prevents concurrent overselling.
  2. Capacity limit check guarantees registrations never exceed maximum seats.
  3. Unique constraint prevents duplicate registrations for the same user and event.
* **Response (201 Created)**:
  ```json
  {
    "success": true,
    "message": "Registration confirmed successfully.",
    "registration": {
      "id": 12,
      "user_id": 8,
      "event_id": 1,
      "event_title": "Cloud Architecture Summit",
      "ticket_code": "SE-1-8-M8A29F-4B9F1A",
      "status": "approved",
      "seat_number": 43,
      "capacity": 100
    }
  }
  ```
* **Error Responses**:
  - `409 Conflict` (`DUPLICATE_REGISTRATION`): Already registered.
  - `409 Conflict` (`CAPACITY_REACHED`): All seats booked.

#### `GET /api/registrations/my`
Lists all bookings and ticket passes for the logged-in user with check-in status.
* **Access**: Authenticated

#### `PATCH /api/registrations/:id/cancel`
Cancels a booking and releases the seat back to the pool.
* **Access**: Authenticated (owner or admin)

#### `GET /api/registrations`
Admin listing of all registrations system-wide with participant profiles.
* **Access**: Admin only

#### `PATCH /api/registrations/:id/status`
Admin approval or rejection of a registration pass.
* **Access**: Admin only

---

### 3.5 Attendance Check-In (`/api/attendance`)

#### `POST /api/attendance/check-in`
Scans and checks in an attendee via unique ticket code or registration ID.
* **Access**: Admin only
* **Request Body**:
  ```json
  {
    "ticket_code": "SE-1-8-M8A29F-4B9F1A",
    "check_in_status": "checked_in",
    "notes": "Verified at Main Entrance"
  }
  ```
* **Protection Mechanisms**:
  - Validates ticket status (`approved`).
  - Enforces `uq_attendance_registration` constraint: strictly rejects duplicate check-ins with `409 Conflict` (`DUPLICATE_CHECKIN`).
* **Response (201 Created)**:
  ```json
  {
    "success": true,
    "message": "Check-in verified and recorded successfully.",
    "attendance": {
      "id": 5,
      "registration_id": 12,
      "ticket_code": "SE-1-8-M8A29F-4B9F1A",
      "participant_name": "Jane Doe",
      "check_in_status": "checked_in",
      "check_in_time": "2026-10-19T13:15:00.000Z",
      "verified_by": "Stratos Administrator"
    }
  }
  ```

#### `GET /api/attendance/verify/:ticketCode`
Pre-scans a ticket code to inspect attendee identity and check-in eligibility without marking attendance.
* **Access**: Admin only

#### `GET /api/attendance/event/:eventId`
Calculates real-time attendance rate metrics and exports attendee roster.
* **Access**: Admin only
* **Response (200 OK)**:
  ```json
  {
    "success": true,
    "metrics": {
      "total_registered": 50,
      "total_approved": 48,
      "total_checked_in": 36,
      "attendance_percentage": "75.0%"
    },
    "roster": [...]
  }
  ```

---

### 3.5 Analytics & Executive Reporting (`/api/analytics`)

#### `GET /api/analytics/overview`
Returns high-level platform KPI metrics, registration breakdown, attendance confirmation ratio, and participant demographics.
* **Access**: Admin only (`Authorization: Bearer <token>`)
* **Response (200 OK)**:
  ```json
  {
    "success": true,
    "overview": {
      "kpis": {
        "total_events": 5,
        "published_events": 4,
        "total_registrations": 7,
        "approved_registrations": 6,
        "checked_in_attendees": 3,
        "attendance_confirmation_ratio": "50.0%",
        "total_published_capacity": 500,
        "capacity_utilization_ratio": "1.4%"
      },
      "registrations_by_status": {
        "approved": 6,
        "pending": 0,
        "rejected": 0,
        "cancelled": 1
      },
      "events_by_status": {
        "published": 4,
        "draft": 1,
        "completed": 0,
        "cancelled": 0
      },
      "demographics": {
        "email_domains": [
          { "domain": "example.com", "count": 6 },
          { "domain": "stratosevent.internal", "count": 1 }
        ],
        "phone_present_count": 7,
        "phone_present_ratio": "100.0%"
      }
    }
  }
  ```

#### `GET /api/analytics/events`
Returns per-event operational analytics, active seats reserved, capacity utilization percentage, and attendance confirmation rates.
* **Access**: Admin only (`Authorization: Bearer <token>`)
* **Response (200 OK)**:
  ```json
  {
    "success": true,
    "events": [
      {
        "id": 1,
        "title": "Cloud Architecture Summit 2026",
        "event_type": "conference",
        "status": "published",
        "capacity": 200,
        "active_registrations": 2,
        "approved_registrations": 2,
        "checked_in_count": 1,
        "capacity_utilization_pct": "1.0%",
        "attendance_rate_pct": "50.0%"
      }
    ]
  }
  ```

#### `GET /api/analytics/export/csv`
Streams an authorized CSV file containing the complete registration and attendance roster for auditing and administrative reporting.
* **Access**: Admin only (`Authorization: Bearer <token>`)
* **Content-Type**: `text/csv; charset=utf-8`
* **Content-Disposition**: `attachment; filename="stratosevent_registrations_<timestamp>.csv"`
* **Response Headers & Format**:
  ```csv
  Registration ID,Ticket Code,Status,Registration Date,Event ID,Event Title,Event Date,Event Venue,Participant ID,Participant Name,Participant Email,Participant Phone,Check-In Status,Check-In Time,Verified By
  1,SE-1-2-XXXXXX-XXXXXX,approved,2026-10-15 10:00:00,1,Cloud Architecture Summit 2026,2026-11-15 09:00:00,Hawkins Lab,2,Jane Doe,jane.doe@example.com,+91-98765-43210,checked_in,2026-10-19 13:00:00,Stratos Administrator
  ```
