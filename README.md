# StratosEvent — Enterprise Event Management & Registration Platform

[![Node.js Version](https://img.shields.io/badge/Node.js-v18%2B%20%7C%20v20%2B-green.svg)](https://nodejs.org/)
[![Database](https://img.shields.io/badge/Database-MySQL%208.0%2B%20(InnoDB)-blue.svg)](https://www.mysql.com/)
[![Tests](https://img.shields.io/badge/Tests-35%2F35%20Passing-brightgreen.svg)](docs/test-case-template.md)
[![Theme](https://img.shields.io/badge/Theme-Stranger%20Things%20%2F%20Hawkins%20Lab-red.svg)](frontend/index.html)
[![License](https://img.shields.io/badge/License-Proprietary-orange.svg)](#)

StratosEvent is a full-stack, enterprise-grade event management, dynamic registration, and real-time attendance verification platform. Featuring an immersive retro-futuristic **Hawkins National Laboratory / Stranger Things** aesthetic, the platform pairs an engaging user experience with strict ACID transactional concurrency, role-based access control, privilege-escalation defenses, and an executive analytics reporting engine.

---

## ⚡ Quick Start (Visual Studio Code on Windows)

### 1. Prerequisites
- **Node.js** (v18.x or v20.x LTS)
- **MySQL Server 8.0+** running locally on port 3306

### 2. Configure Environment
1. In `backend/`, copy `.env.example` to `.env`:
   ```powershell
   cd backend
   Copy-Item .env.example .env
   ```
2. Ensure your MySQL credentials in `backend/.env` match your local setup:
   ```ini
   PORT=5000
   NODE_ENV=development
   DB_HOST=localhost
   DB_PORT=3306
   DB_USER=root
   DB_PASSWORD=YourPassword
   DB_NAME=stratosevent_db
   JWT_SECRET=your_super_secret_jwt_key_change_in_production
   ```

### 3. One-Click Launch in VS Code
Open this project folder in Visual Studio Code:
- **Run Backend**: Press `F5` or select **"StratosEvent Backend Server (Port 5000)"** in the Run & Debug view.
- **Run Tasks**: Press `Ctrl + Shift + P` ➔ `Tasks: Run Task` ➔ Select:
  - `Start StratosEvent Backend Server`
  - `Start StratosEvent Frontend Server` (Serves UI at `http://localhost:3000`)
  - `Run Full Automated Test Suite` (Runs all 35 tests)
  - `Run E2E Verification Suite` (Runs 26 end-to-end integration assertions)

---

## 🔑 Default Accounts (Seed Data)

| Role | Email | Password | Access Level |
| :--- | :--- | :--- | :--- |
| **System Admin** | `admin@stratosevent.internal` | `AdminPass@123` | Full Admin Console, Event CRUD, Approvals, Gate Scanner, Analytics & CSV Export |
| **Participant** | `participant1@example.com` | `Password123!` | Event Discovery, Ticket Booking, Self-Cancellation, My Tickets Pass View |

---

## 📚 Complete Project Documentation

All formal technical deliverables and engineering artifacts are located in the [`docs/`](docs/) directory:

| Document | Description | Link |
| :--- | :--- | :--- |
| **Requirements Traceability Matrix** | Bidirectional mapping of all 10 objectives and milestones with live verification evidence | [requirements-traceability.md](docs/requirements-traceability.md) |
| **Software Requirements Specification (SRS)** | Formal specification (Problem statement, stakeholders, FR-01 to FR-07, NFR-01 to NFR-04) | [SRS.md](docs/SRS.md) |
| **System Flow Diagrams** | 7 Mermaid sequence and activity workflows (Auth, Registration, Locking, Scanner, etc.) | [system-flow-diagrams.md](docs/system-flow-diagrams.md) |
| **UI Wireframes** | ASCII/Markdown wireframes detailing layout, typography, and controls across 8 screens | [wireframes.md](docs/wireframes.md) |
| **Functional Test Case Template & Log** | Formal test case template and log of all 26 verified operational test runs | [test-case-template.md](docs/test-case-template.md) |
| **REST API Documentation** | Complete API reference including Auth, Events, Registrations, Attendance, and Analytics | [api-documentation.md](docs/api-documentation.md) |
| **Deployment Checklist & Operational Guide** | Production environment readiness, security configuration, smoke tests, and rollback plan | [deployment-checklist.md](docs/deployment-checklist.md) |
| **Technical Manual & Architecture Guide** | Comprehensive guide covering system design, Windows setup, VS Code integration, and troubleshooting | [technical-manual.md](docs/technical-manual.md) |
| **Final Project Report** | Formal academic/industry submission report detailing problem, architecture, security, and results | [project-report.md](docs/project-report.md) |
| **Entity-Relationship Diagram (ERD)** | Relational data model, schema analysis, cascade rules, and indexing strategy | [erd.md](docs/erd.md) |

---

## 🧪 Testing & Verification

StratosEvent includes automated test suites with built-in database state preservation:

```powershell
# Run the 35 automated unit & integration tests
cd backend
npm test

# Run the 26-step End-to-End operational verification
node tests/e2e_verification.js
```

Both suites execute against the live MySQL database and automatically clean up test-created records, guaranteeing the original baseline data (7 users, 5 events, 7 registrations, 3 attendance records) remains 100% intact.

---

## 🛡️ Security Architecture Highlights
- **CWE-269 Mitigation**: Public registration unconditionally forces `role: 'participant'`, ignoring client payload overrides.
- **Transactional Capacity Locking**: `SELECT ... FOR UPDATE` prevents ticket overselling during concurrent booking spikes.
- **Bcrypt & JWT HS256**: Cryptographically salted passwords and algorithm-pinned JWTs with production secret guards.
- **Duplicate Prevention**: Database-level unique constraints on registrations and attendance records.
