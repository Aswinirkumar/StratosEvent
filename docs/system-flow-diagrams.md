# StratosEvent — System Flow Diagrams

Comprehensive architectural workflows and sequence diagrams for the **StratosEvent** enterprise event platform.

---

## 1. Participant Registration & Authentication Flow

```mermaid
sequenceDiagram
    autonumber
    actor User as Participant Browser
    participant API as Express API (/api/auth)
    participant Val as Input Validator
    participant Hash as Bcrypt Engine
    participant DB as MySQL (users table)
    participant JWT as JWT Signer (HS256)

    User->>API: POST /api/auth/register {full_name, email, password, role="admin"}
    API->>Val: validateRegister()
    Val-->>API: Sanitize: delete req.body.role, format email
    API->>DB: SELECT id FROM users WHERE email = ?
    alt Email Already Exists
        DB-->>API: Found existing user record
        API-->>User: HTTP 409 Conflict (EMAIL_ALREADY_EXISTS)
    else Email Unique
        API->>Hash: hash(password, 10 rounds)
        Hash-->>API: password_hash
        Note over API,DB: Security: assignedRole is strictly hardcoded to "participant"
        API->>DB: INSERT INTO users (full_name, email, password_hash, role='participant')
        DB-->>API: insertId
        API->>JWT: generateToken({id, email, role: 'participant'})
        JWT-->>API: Bearer JWT
        API-->>User: HTTP 201 Created {token, user: {role: 'participant'}}
    end
```

---

## 2. Event Discovery & Real-Time Availability Flow

```mermaid
flowchart TD
    A["Participant Opens Web App (http://localhost:3000)"] --> B["DOMContentLoaded Event"]
    B --> C["Fetch GET http://localhost:5000/api/events"]
    C --> D{"API Online & MySQL Connected?"}
    
    D -- "Yes" --> E["Receive Real JSON Events from MySQL"]
    E --> F["Update Badge: 'Live MySQL Database Connected' (Green)"]
    D -- "No (Fallback)" --> G["Load Built-in DEMO_EVENTS Array"]
    G --> H["Update Badge: 'Demonstration Data' (Secondary)"]
    
    F --> I["Execute Client-Side Filtering (Search Input & Category Dropdown)"]
    H --> I
    I --> J["Compute Seat Availability: GREATEST(0, capacity - registered)"]
    J --> K{"Available Seats Count"}
    K -- "Available > 10" --> L["Render Green Badge: 'X / Y FREE'"]
    K -- "Available 1 to 10" --> M["Render Yellow Warning: 'X SEATS LEFT'"]
    K -- "Available <= 0" --> N["Render Red Badge: 'SOLD OUT' + Disabled Button"]
```

---

## 3. Concurrency-Guarded Event Booking & Capacity Locking

```mermaid
sequenceDiagram
    autonumber
    actor User as Authenticated Participant
    participant API as Express API (/api/registrations)
    participant Auth as authenticateToken Middleware
    participant Conn as MySQL Connection Pool
    participant DB as InnoDB Engine (events & registrations)

    User->>API: POST /api/registrations {event_id: 1} + Bearer Token
    API->>Auth: Verify JWT signature (HS256)
    Auth-->>API: Authenticated (req.user.id)
    API->>Conn: getConnection()
    Conn-->>API: Active Database Connection
    API->>DB: BEGIN TRANSACTION

    Note over API,DB: CRITICAL: Row-level lock to prevent concurrent overbooking
    API->>DB: SELECT id, capacity, status FROM events WHERE id = ? FOR UPDATE
    DB-->>API: Event Data (Capacity = 60, Status = 'published')

    API->>DB: SELECT id, status FROM registrations WHERE user_id = ? AND event_id = ? FOR UPDATE
    alt Duplicate Booking Found (status != 'cancelled')
        DB-->>API: Existing registration row
        API->>DB: ROLLBACK
        API-->>User: HTTP 409 Conflict (DUPLICATE_REGISTRATION)
    else Eligible for Booking
        API->>DB: SELECT COUNT(*) AS active_count FROM registrations WHERE event_id = ? AND status IN ('approved','pending') FOR UPDATE
        DB-->>API: active_count
        alt Capacity Reached (active_count >= capacity)
            API->>DB: ROLLBACK
            API-->>User: HTTP 409 Conflict (CAPACITY_REACHED)
        else Seat Available
            Note over API: Generate Alphanumeric Ticket: SE-eventId-userId-timestamp-hex
            API->>DB: INSERT INTO registrations (user_id, event_id, ticket_code, status='approved')
            DB-->>API: registrationId
            API->>DB: COMMIT TRANSACTION
            API-->>User: HTTP 201 Created {ticket_code, status: 'approved'}
        end
    end
```

---

## 4. Registration Approval & Moderation Workflow

```mermaid
flowchart TD
    A["Event Created by Admin"] --> B{"Event Admission Policy"}
    B -- "Standard Open Event" --> C["Registration Auto-Approved ('approved')"]
    B -- "Exclusive / Invite-Only" --> D["Registration Placed in 'pending' State"]
    
    C --> E["Seat Reserved Against Event Capacity"]
    D --> E
    
    D --> F["Admin Opens Admin Console -> Registration Approvals"]
    F --> G["Select Event & Review Attendee Applications"]
    
    G --> H{"Admin Moderation Decision"}
    H -- "Approve" --> I["PATCH /api/registrations/:id/status {status: 'approved'}"]
    I --> J["Status Updated to 'approved'; Ticket Validated for Check-In"]
    
    H -- "Reject" --> K["PATCH /api/registrations/:id/status {status: 'rejected'}"]
    K --> L["Status Updated to 'rejected'; Seat Released Back to Pool"]
```

---

## 5. Booking History & Participant Cancellation Flow

```mermaid
sequenceDiagram
    autonumber
    actor User as Participant
    participant API as Express API (/api/registrations)
    participant DB as MySQL (registrations table)

    User->>API: GET /api/registrations/my (Bearer Token)
    API->>DB: SELECT r.*, e.title, e.venue FROM registrations r JOIN events e ON r.event_id = e.id WHERE r.user_id = ?
    DB-->>API: Active & Historical Passes
    API-->>User: HTTP 200 OK {registrations: [...]}

    User->>API: PATCH /api/registrations/:id/cancel
    API->>DB: SELECT * FROM registrations WHERE id = ? AND user_id = ?
    alt Not Owned by User
        API-->>User: HTTP 403 Forbidden
    else Owned by User
        API->>DB: UPDATE registrations SET status = 'cancelled' WHERE id = ?
        DB-->>API: 1 row affected
        Note over DB: Seat is immediately released; count aggregation decrements
        API-->>User: HTTP 200 OK {message: "Registration cancelled successfully"}
    end
```

---

## 6. Ticket Inspection & Attendance Gate Check-In

```mermaid
sequenceDiagram
    autonumber
    actor Admin as Gate Attendant (Admin)
    participant API as Express API (/api/attendance)
    participant DB as MySQL (attendance table)

    Admin->>API: GET /api/attendance/verify/:ticketCode
    API->>DB: SELECT r.*, u.full_name, a.id AS checkin_id, a.check_in_time FROM registrations r LEFT JOIN attendance a ON r.id = a.registration_id WHERE r.ticket_code = ?
    alt Ticket Not Found
        API-->>Admin: HTTP 404 Not Found (TICKET_NOT_FOUND)
    else Registration Not Approved
        API-->>Admin: HTTP 400 Bad Request (REGISTRATION_NOT_APPROVED)
    else Already Checked In
        API-->>Admin: HTTP 200 OK {is_already_checked_in: true, check_in_time: '...'}
        Note over Admin: Screen displays Warning: "DUPLICATE ENTRY ALERT"
    else Valid & Eligible
        API-->>Admin: HTTP 200 OK {can_check_in: true, participant_name: '...'}
        Admin->>API: POST /api/attendance/check-in {ticket_code, notes: "Gate 1"}
        API->>DB: INSERT INTO attendance (registration_id, check_in_status='checked_in', verified_by, notes)
        alt Unique Constraint Violation (uq_attendance_registration)
            DB-->>API: ER_DUP_ENTRY (1062)
            API-->>Admin: HTTP 409 Conflict (DUPLICATE_CHECKIN)
        else Check-In Success
            DB-->>API: insertId
            API-->>Admin: HTTP 201 Created {status: "checked_in", timestamp: "..."}
        end
    end
```

---

## 7. Executive Analytics & Reporting Engine Flow

```mermaid
flowchart LR
    Admin["Authenticated Administrator"] --> Req1["GET /api/analytics/overview"]
    Admin --> Req2["GET /api/analytics/events"]
    Admin --> Req3["GET /api/analytics/export/csv"]

    subgraph Backend_Aggregation [MySQL Relational Aggregation]
        Q1["COUNT(*) GROUP BY events.status"]
        Q2["COUNT(*) GROUP BY registrations.status"]
        Q3["Attendance Confirmation Ratio = (checked_in / approved) * 100"]
        Q4["Capacity Utilization = (active_regs / total_capacity) * 100"]
        Q5["Demographics: SUBSTRING_INDEX(email, '@', -1)"]
    end

    Req1 --> Backend_Aggregation
    Req2 --> Backend_Aggregation
    Req3 --> Backend_Aggregation

    Backend_Aggregation --> Card1["4 Top KPI Intelligence Cards"]
    Backend_Aggregation --> Card2["Event Capacity Utilization Table"]
    Backend_Aggregation --> Card3["Participant Domain Insights"]
    Backend_Aggregation --> CSV["Streamed CSV File Download (.csv)"]
```
