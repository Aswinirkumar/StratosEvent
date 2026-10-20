# StratosEvent: Enterprise Event Management & Registration Platform
## Comprehensive Final Project Report & System Documentation

---

**Project Title**: StratosEvent — Scalable Event Management, Dynamic Registration & Real-Time Attendance Platform  
**Thematic Design**: Hawkins Department of Energy / Stranger Things Retro-Futuristic Aesthetic  
**Target Environment**: Windows 10/11 & Linux Server Environments  
**Tech Stack**: Node.js, Express.js, MySQL 8.0+ (InnoDB), HTML5, CSS3, JavaScript (ES6+), Bootstrap 5  
**Date**: October 20, 2026  
**Status**: Completed, Fully Tested & Submission Ready  

---

## 1. Executive Summary & Abstract

Traditional event management relies heavily on disconnected spreadsheets, manual sign-in sheets, and uncoordinated registration forms. This paradigm suffers from critical failure modes: accidental overbooking due to concurrency race conditions, duplicate registrations, forged entry passes, lack of real-time seat availability visibility, and inefficient post-event attendance reconciliation.

**StratosEvent** solves these systemic problems by delivering a robust, secure, full-stack event management and attendee lifecycle platform. Featuring a distinctive retro-futuristic "Stranger Things" terminal user interface, StratosEvent pairs high visual engagement with enterprise-grade engineering principles:
- **ACID-Compliant Concurrency**: Employs row-level database locking (`SELECT ... FOR UPDATE`) inside atomic transactions to eliminate overbooking and duplicate registrations under high traffic.
- **Role-Based Access Control (RBAC)**: Distinguishes between public discovery, authenticated participants, and administrators, with robust defense-in-depth security preventing privilege escalation.
- **End-to-End Attendee Lifecycle**: Tracks participants from initial registration through administrative moderation (Approved/Rejected) to gatekeeper attendance check-in.
- **Executive Analytics Engine**: Delivers real-time KPI metrics, capacity utilization tracking, participant demographics, and one-click authorized CSV data exports.

The platform has been audited against all requirements, achieving **100% test pass rates across 35 backend tests and 26 end-to-end integration flows**, with zero database drift and seamless zero-overflow responsiveness across mobile and desktop viewports.

---

## 2. Problem Statement & Motivation

Prior to the introduction of StratosEvent, organizations faced recurring operational obstacles:
1. **Concurrency Race Conditions**: Multiple users submitting simultaneous registrations for the final available seats resulted in overbooking and customer dissatisfaction.
2. **Duplicate Bookings**: Participants accidentally or intentionally submitting multiple registrations wasted venue capacity.
3. **Privilege Escalation Risks**: Naive user registration endpoints that trust client-supplied roles create severe security vulnerabilities allowing unauthorized administrative access.
4. **Manual Spreadsheet Reliance**: Event coordinators struggled to reconcile paper sign-in rosters with online attendee lists, preventing accurate attendance rate calculations.
5. **Slow, Bloated Frontend Architectures**: Modern SPA frameworks often introduce hundreds of megabytes of dependencies, slow first-contentful-paint times, and fragile build chains.

StratosEvent was engineered specifically to address these challenges with native web standards, database transactions, and deterministic RESTful APIs.

---

## 3. Project Objectives & Traceability Summary

The project fulfilled all 10 core architectural objectives:

| Objective | Target Requirement | Implementation Detail | Status |
| :--- | :--- | :--- | :---: |
| **OBJ-01** | Event Lifecycle Management | Admin console creates, updates, and archives events with date, venue, capacity, and categories. | `VERIFIED` |
| **OBJ-02** | Participant Discovery & Booking | Responsive card catalog with instant keyword search and category filtering. | `VERIFIED` |
| **OBJ-03** | Ticket Tiers & Categories | Multi-category support (Workshop, Webinar, Conference, Hackathon, Seminar) + Migration script. | `VERIFIED` |
| **OBJ-04** | Administrative Moderation | Multi-status registration approval pipeline (`pending`, `approved`, `rejected`, `cancelled`). | `VERIFIED` |
| **OBJ-05** | Attendee Lifecycle Tracking | Complete 4-stage tracking from registration to gatekeeper check-in. | `VERIFIED` |
| **OBJ-06** | Duplicate & Overbooking Guard | Row-level locking (`SELECT ... FOR UPDATE`) + unique DB constraints (`uq_registrations_user_event`). | `VERIFIED` |
| **OBJ-07** | Real-Time Seat Availability | Dynamic SQL availability aggregation displayed via real-time UI badges. | `VERIFIED` |
| **OBJ-08** | Executive Analytics & Reporting | Real-time KPI cards, capacity utilization gauges, domain demographics, and CSV export. | `VERIFIED` |
| **OBJ-09** | Professional Administration | Unified Hawkins Admin Console with live roster management, search, and gate scanner. | `VERIFIED` |
| **OBJ-10** | High-Quality Testing & Security | 35 backend tests, 26 E2E tests, CWE-269 mitigation, HS256 JWT, zero mobile overflow. | `VERIFIED` |

---

## 4. System Architecture & Technology Stack

StratosEvent utilizes a decoupled, three-tier architecture designed for high maintainability, rapid deployment, and minimal operational overhead.

```mermaid
graph TD
    subgraph Client Tier
        UI["Stranger Things Responsive UI<br>(HTML5, CSS3, ES6+, Bootstrap 5)"]
    end

    subgraph Application Tier
        API["Express.js RESTful API Engine<br>(Node.js v18/20 LTS)"]
        AUTH["Auth & RBAC Middleware<br>(Bcrypt, JWT HS256)"]
        LOCK["Concurrency Controller<br>(Row Locks / Transactions)"]
    end

    subgraph Data Tier
        DB[("MySQL 8.0 InnoDB Database<br>(ACID Storage Engine)")]
    end

    UI <-->|JSON REST over HTTP| API
    API --> AUTH
    API --> LOCK
    LOCK <-->|Connection Pool / SQL| DB
```

### Technology Selections & Justifications:
- **Node.js & Express.js**: Asynchronous, event-driven runtime ideal for high-throughput I/O and rapid REST API delivery.
- **MySQL 8.0+ (InnoDB)**: Provides ACID transactions, row-level locking (`FOR UPDATE`), foreign key cascading, and strict unique constraints required for ticket inventory protection.
- **Vanilla ES6+ JavaScript**: Zero-bundler architecture ensures fast loading, instant hot-reloading in VS Code, and zero dependency vulnerabilities in the client.
- **Bootstrap 5 + Custom CSS**: Responsive grid system combined with customized retro-glow CRT monitors, monospace scanlines, and Stranger Things red typography.

---

## 5. Database Design & Entity Relationships

The relational schema ensures complete referential integrity across all system entities:

```mermaid
erDiagram
    USERS ||--o{ REGISTRATIONS : "places"
    USERS ||--o{ ATTENDANCE : "verifies"
    EVENTS ||--o{ REGISTRATIONS : "contains"
    REGISTRATIONS ||--o| ATTENDANCE : "validates"

    USERS {
        int id PK
        varchar full_name
        varchar email UK
        varchar password_hash
        enum role "admin, participant"
        varchar phone_number
        timestamp created_at
    }

    EVENTS {
        int id PK
        varchar title
        text description
        enum event_type "workshop, webinar, conference, hackathon, seminar"
        datetime event_date
        varchar venue
        int capacity
        enum status "draft, published, completed, cancelled"
        timestamp created_at
    }

    REGISTRATIONS {
        int id PK
        int user_id FK
        int event_id FK
        varchar ticket_code UK
        enum status "pending, approved, rejected, cancelled"
        timestamp registration_date
    }

    ATTENDANCE {
        int id PK
        int registration_id FK,UK
        timestamp check_in_time
        enum check_in_status "checked_in, no_show"
        int verified_by FK
        varchar notes
    }
```

### Crucial Data Guarantees:
- **`uq_registrations_user_event`**: Composite unique index `(user_id, event_id)` preventing a user from booking the same event twice.
- **`uq_attendance_registration`**: Unique constraint on `registration_id` guaranteeing that an entry ticket pass can only be checked in once.
- **Foreign Key Constraints with Cascade**: Ensures database cleanliness by automatically purging dependent registrations and attendance records if parent entities are deleted.

---

## 6. Security Architecture & Threat Mitigation

StratosEvent was engineered with a strict defense-in-depth posture:

1. **Privilege Escalation Prevention (CWE-269)**:
   - *Threat*: Attackers intercept registration payloads and inject `"role": "admin"` to acquire administrative control.
   - *Mitigation*: The registration controller (`backend/routes/auth.js`) unconditionally assigns `assignedRole = 'participant'`, completely disregarding client payloads.
2. **Password Storage & Cryptographic Hashing**:
   - Uses `bcrypt` with 10 salt rounds. Passwords are bound to a maximum length of 128 characters to prevent CPU-exhaustion Denial-of-Service attacks.
3. **JWT Algorithm Pinning**:
   - Token creation and verification explicitly specify `algorithm: 'HS256'`. This mitigates algorithm downgrade and algorithm-switching exploits.
4. **Production Startup Hardening**:
   - In `NODE_ENV=production`, the application refuses to boot if `JWT_SECRET` remains set to insecure default placeholders.
5. **Credential Protection**:
   - Environment variables are isolated in `.env`, and git tracking explicitly ignores all environment and secret files via `.gitignore`.

---

## 7. Thematic Frontend & User Experience Design

The frontend user experience adopts the iconic visual language of **Hawkins National Laboratory (Stranger Things)**:
- **Color Palette**: Void Black (`#0a0709`), Hawkins Lab Crimson (`#ff1744`), Upside Down Teal (`#00e5ff`), and Amber CRT warning indicators (`#ff9100`).
- **Typography**: Retro-futuristic serif display headers paired with monospace technical indicators (`Courier New`, monospace).
- **Responsive Engineering**: Fully tested across extreme viewport resolutions:
  - **Desktop (1400px)**: Fluid 3-column event grid, sticky navigation header, and comprehensive administrative command console.
  - **Mobile (375px)**: Collapsible mobile navigation drawer, fluid touch targets (>= 44px), zero horizontal overflow (`0px`), and stacked metric cards.

---

## 8. Verification & Quality Assurance Results

StratosEvent was subjected to exhaustive automated and manual verification:

### Automated Backend Test Suite (`backend/tests/api.test.js`):
- **Total Test Cases**: 35 assertions across 9 test suites.
- **Execution Time**: 1.46 seconds.
- **Pass Rate**: **100% (35 Passed, 0 Failed)**.
- **Test Categories**:
  1. System Health & Environment Readiness (2 tests)
  2. Participant Registration & Privilege Escalation Defense (3 tests)
  3. Authentication & JWT Validation (3 tests)
  4. Event Catalog & Management (5 tests)
  5. Registration Flow, Concurrency & Overbooking Guard (4 tests)
  6. Self-Service Booking Cancellation (2 tests)
  7. Administrator Moderation & Pass Issuance (4 tests)
  8. Attendance Verification, Scanning & Duplicate Check-in Prevention (5 tests)
  9. Executive Analytics & CSV Export (7 tests)

### End-to-End Simulation Suite (`backend/tests/e2e_verification.js`):
- **Total Integration Steps**: 26 sequential real-world operational flows.
- **Pass Rate**: **100% (26 Passed, 0 Failed)**.
- **Data Preservation**: Pre- and post-test counts confirmed exact preservation of the seeded baseline database: **7 users, 5 events, 7 registrations, and 3 attendance records**.

---

## 9. Conclusion & Project Deliverables Checklist

StratosEvent represents an enterprise-grade event management solution combining technical rigor, security hardening, robust data persistence, and an immersive user interface.

### Complete Deliverables Index:
- [x] **Source Code**: Express.js REST API (`backend/`) and Stranger Things UI (`frontend/`)
- [x] **Database Architecture**: `database/schema.sql`, `database/seed.sql`, and `database/migrations/`
- [x] **Requirements Traceability Matrix**: [`docs/requirements-traceability.md`](file:///c:/Users/Admin/Desktop/StratosEvent/docs/requirements-traceability.md)
- [x] **Software Requirements Specification**: [`docs/SRS.md`](file:///c:/Users/Admin/Desktop/StratosEvent/docs/SRS.md)
- [x] **System Flow Diagrams (7 Workflows)**: [`docs/system-flow-diagrams.md`](file:///c:/Users/Admin/Desktop/StratosEvent/docs/system-flow-diagrams.md)
- [x] **Wireframe Specifications (8 Screens)**: [`docs/wireframes.md`](file:///c:/Users/Admin/Desktop/StratosEvent/docs/wireframes.md)
- [x] **Functional Test Case Template & Log**: [`docs/test-case-template.md`](file:///c:/Users/Admin/Desktop/StratosEvent/docs/test-case-template.md)
- [x] **REST API Documentation**: [`docs/api-documentation.md`](file:///c:/Users/Admin/Desktop/StratosEvent/docs/api-documentation.md)
- [x] **Deployment Checklist & Operational Guide**: [`docs/deployment-checklist.md`](file:///c:/Users/Admin/Desktop/StratosEvent/docs/deployment-checklist.md)
- [x] **Technical Manual & Architecture Guide**: [`docs/technical-manual.md`](file:///c:/Users/Admin/Desktop/StratosEvent/docs/technical-manual.md)
- [x] **Final Project Report**: [`docs/project-report.md`](file:///c:/Users/Admin/Desktop/StratosEvent/docs/project-report.md)
- [x] **VS Code One-Click Launch & Tasks**: [`.vscode/launch.json`](file:///c:/Users/Admin/Desktop/StratosEvent/.vscode/launch.json) and [`.vscode/tasks.json`](file:///c:/Users/Admin/Desktop/StratosEvent/.vscode/tasks.json)
