# StratosEvent — Event Management & Registration Platform

A full-stack web application designed for seamless event planning, discovery, registration, and attendance tracking. Developed as part of the **TCS iON Industry Project**.

---

## 📌 Project Overview
**StratosEvent** connects event organizers and attendees on a single unified platform. It empowers administrators to schedule and supervise campus/corporate events (workshops, webinars, hackathons, and conferences), while enabling participants to explore events, reserve seats, and receive verified digital tickets.

---

## 🛠️ Technology Stack
- **Frontend**: HTML5, CSS3, JavaScript (ES6+), Bootstrap 5
- **Backend**: Node.js, Express.js
- **Database**: MySQL 8.0+ (Relational Database with InnoDB engine)
- **Documentation**: Markdown, Mermaid Diagrams

---

## 🗄️ Database Design Overview

The database uses 4 relational tables designed in `database/schema.sql`:

1. **`users`**: Manages credentials and roles (`admin`, `participant`). Passwords are kept as cryptographic hashes.
2. **`events`**: Stores event details, event types (`workshop`, `webinar`, `conference`, `hackathon`, `seminar`), schedules, venues, and seat capacities.
3. **`registrations`**: Connects users to events.
   - Enforces `UNIQUE(user_id, event_id)` to prevent participants from registering for the same event multiple times.
   - Generates unique ticket codes for each booking.
4. **`attendance`**: Tracks check-in status on event day.
   - Enforces `UNIQUE(registration_id)` to prevent duplicate check-ins.

> For visual diagrams and deep-dive schema documentation, see:
> - [Entity-Relationship Diagram (docs/erd.md)](file:///c:/Users/Admin/Desktop/StratosEvent/docs/erd.md)
> - [Requirement Analysis & Feature Mapping (docs/requirement-analysis.md)](file:///c:/Users/Admin/Desktop/StratosEvent/docs/requirement-analysis.md)

---

## 📁 Project File Structure

```text
StratosEvent/
├── database/
│   ├── schema.sql              # Table definitions, constraints, and indexes
│   └── seed.sql                # Safe sample data for local development & testing
│
├── docs/
│   ├── README.md               # Main project documentation & setup guide
│   ├── requirement-analysis.md # TCS iON requirement-to-feature mapping
│   └── erd.md                  # Mermaid ER diagram & cardinality breakdown
│
├── frontend/                   # Client-side user interface (HTML5, CSS3, JS, Bootstrap 5)
│   ├── index.html              # Responsive landing page & event catalog
│   ├── css/
│   │   └── style.css           # Custom styling & responsive layouts
│   └── js/
│       └── main.js             # Dynamic catalog rendering, filters & API integration
│
└── backend/                    # Server-side application (Node.js & Express)
    ├── .env.example            # Environment variables configuration template
    ├── .gitignore              # Git ignore rules for node_modules and .env
    ├── package.json            # Node.js dependencies and run scripts
    ├── server.js               # Application entry point & health check
    └── config/
        └── db.js               # MySQL connection pool configuration
```

---

## ⚙️ Prerequisites

Before running the project locally, ensure you have:
1. **[Node.js](https://nodejs.org/)** (v16.x or v18.x+ LTS)
2. **[MySQL Server](https://dev.mysql.com/downloads/mysql/)** (v8.0+) or **[XAMPP / WAMP](https://www.apachefriends.org/)** with MySQL running.
3. **MySQL Workbench**, **phpMyAdmin**, or MySQL Command Line Client.
4. A code editor like **Visual Studio Code**.

---

## 🚀 Database Setup Instructions

> **Note**: The SQL scripts have been created in your project workspace. They have **not** been automatically executed on your MySQL server yet. Follow these steps to import them when ready:

### Option A: Using MySQL Command Line (CLI)
1. Open your terminal or Command Prompt.
2. Log into MySQL:
   ```bash
   mysql -u root -p
   ```
3. Run the schema script to create the database and tables:
   ```sql
   source c:/Users/Admin/Desktop/StratosEvent/database/schema.sql;
   ```
4. (Optional) Run the seed script to load sample test data:
   ```sql
   source c:/Users/Admin/Desktop/StratosEvent/database/seed.sql;
   ```

### Option B: Using MySQL Workbench
1. Open **MySQL Workbench** and connect to your local MySQL instance.
2. Go to **File ➔ Open SQL Script...** and select `database/schema.sql`.
3. Click the ⚡ **Execute** button to create the `stratosevent_db` database and its tables.
4. Next, open `database/seed.sql` and click ⚡ **Execute** to insert sample data.

### Option C: Using XAMPP (phpMyAdmin)
1. Start Apache and MySQL from the XAMPP Control Panel.
2. Navigate to `http://localhost/phpmyadmin` in your browser.
3. Click on the **Import** tab at the top.
4. Click **Choose File**, select `database/schema.sql`, and click **Import**.
5. Repeat the import for `database/seed.sql` to populate sample data.

---

## ⚡ Backend Setup & Running Instructions

Follow these steps once you have installed Node.js on your machine:

### 1. Open the Backend Directory
Open your terminal or command prompt inside the `backend` folder:
```bash
cd c:\Users\Admin\Desktop\StratosEvent\backend
```

### 2. Install Project Dependencies
Install all required packages (`express`, `mysql2`, `dotenv`, `cors`, and dev-dependency `nodemon`):
```bash
npm install
```

### 3. Create your `.env` File
Make a copy of `.env.example` named `.env`:
```bash
copy .env.example .env
```
Open `.env` and set your `DB_PASSWORD` (and username if different from `root`).

### 4. Start the Application
- **For Development (with automatic reload on file changes):**
  ```bash
  npm run dev
  ```
- **For Standard Production Run:**
  ```bash
  npm start
  ```

### 5. Verify API Health
Open your web browser or API tool (such as Postman) and visit:
- **`http://localhost:5000/`** — Server welcome response.
- **`http://localhost:5000/api/health`** — Health check endpoint reporting server and database status.

---

## 🖥️ Viewing the Frontend Landing Page

You can preview the frontend immediately without any running server:
1. Navigate to `frontend/index.html` in your file explorer.
2. Double-click **`index.html`** to open it directly in any modern web browser (Chrome, Edge, Firefox).
3. Alternatively, right-click `frontend/index.html` inside VS Code and choose **Open with Live Server** if you have the Live Server extension installed.

---

## 📁 Project Documentation Index

All technical documents, architectural analyses, and test artifacts are available in this folder:

| Document | Description |
| :--- | :--- |
| **[requirements-traceability.md](requirements-traceability.md)** | Bidirectional traceability matrix verifying all 10 objectives, Milestones 1–4, and verification evidence |
| **[SRS.md](SRS.md)** | Complete Software Requirements Specification (Functional & Non-Functional Requirements) |
| **[system-flow-diagrams.md](system-flow-diagrams.md)** | 7 Mermaid sequence diagrams depicting all core user, admin, and system flows |
| **[wireframes.md](wireframes.md)** | Comprehensive wireframe specifications for all 8 application screens |
| **[test-case-template.md](test-case-template.md)** | Standardized test case template and log of all 26 verified operational test cases |
| **[api-documentation.md](api-documentation.md)** | Complete REST API reference covering Auth, Events, Registrations, Attendance, and Analytics |
| **[deployment-checklist.md](deployment-checklist.md)** | Production deployment, security hardening, smoke tests, and rollback procedures |
| **[technical-manual.md](technical-manual.md)** | System architecture, Windows setup, VS Code integration, and troubleshooting guide |
| **[project-report.md](project-report.md)** | Comprehensive academic and industry final project report |
| **[erd.md](erd.md)** | Relational database schema, entity attributes, and constraints |
| **[requirement-analysis.md](requirement-analysis.md)** | Core domain analysis and feature mapping |

---

## 🔒 Security & Data Integrity Highlights
- **No Plaintext Passwords**: All user passwords in `database/seed.sql` are stored as Bcrypt hashes.
- **Seat Capacity Protection**: Designed for pessimistic locking (`SELECT ... FOR UPDATE`) in the Express backend to prevent race conditions during peak registrations.
- **Duplicate Prevention**: Hardware/DB level constraints block duplicate bookings and duplicate ticket check-ins.


