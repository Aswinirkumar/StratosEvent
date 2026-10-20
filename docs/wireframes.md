# StratosEvent — User Interface Wireframes & Screen Specifications

Detailed architectural wireframes, component layouts, and visual hierarchy for the 8 core screens of **StratosEvent**.

---

## 1. Screen 1: Participant Event Listing & Discovery
**Implemented Component**: Homepage Main Catalog (`frontend/index.html` `#eventsCatalog`)  
**Purpose**: Public event discovery, category filtering, keyword searching, and live capacity tracking.

```text
+---------------------------------------------------------------------------------------------------+
|  [Logo] STRATOSEVENT [HAWKINS '83]     Home   Explore Events   How It Works   Features   [Login] [Admin] |
+---------------------------------------------------------------------------------------------------+
|  (•) HAWKINS LAB • LIVE EVENT DISPATCH                                                            |
|  ENTER THE UPSIDE DOWN OF TECH & CAMPUS EVENTS.        +----------------------------------------+ |
|  Discover and register for engineering summits,        | SECURITY & PROTOCOL HUD       V1.0     | |
|  hackathons, and technical workshops.                  | [Capacity Lock]      [Composite Key]   | |
|  [Explore Events] [How It Works]                       | [Verified Pass]      [4-Stage Pipeline]| |
|                                                        +----------------------------------------+ |
+---------------------------------------------------------------------------------------------------+
|  EXPLORE AVAILABLE EVENTS                   [Showing 4 of 4 events] [Live MySQL Database Connected]|
|  +-------------------------------------------------------------+ +------------------------------+ |
|  | [Q] Search by keyword, title, venue...                      | | Category: All Categories [v] | |
|  +-------------------------------------------------------------+ +------------------------------+ |
|                                                                                                   |
|  +-----------------------------+ +-----------------------------+ +------------------------------+ |
|  | [BANNER: Workshop CPU Icon] | | [BANNER: Webinar Video Icon]| | [BANNER: Hackathon Bolt Icon] | |
|  | Workshop        #EVT-001    | | Webinar          #EVT-002   | | Hackathon         #EVT-003   | |
|  | Cloud Native Kubernetes     | | NextGen AI & LLM Systems    | | CodeStorm Hackathon 2026     | |
|  | Hands-on deep dive into...  | | Enterprise applications...  | | 24-hour rapid innovation...  | |
|  | [Cal] Nov 05, 2026 • 09:30  | | [Cal] Nov 12, 2026 • 15:00  | | [Cal] Nov 20, 2026 • 08:00   | |
|  | [Pin] Synergy Tech Park     | | [Pin] Online Webex Session  | | [Pin] Tech Park Phase 2      | |
|  | Availability: [57/60 FREE]  | | Availability: [248/250 FREE]| | Availability: [118/120 FREE] | |
|  | [====                    ]  | | [=                         ]| | [=                          ]| |
|  | [ View Details & Register ] | | [ View Details & Register ] | | [ View Details & Register ]  | |
|  +-----------------------------+ +-----------------------------+ +------------------------------+ |
+---------------------------------------------------------------------------------------------------+
```

---

## 2. Screen 2: Interactive Authentication Modal (Login & Register)
**Implemented Component**: Auth Modal (`frontend/index.html` `#authNoticeModal`)  
**Purpose**: Secure participant authentication and self-registration.

```text
+-----------------------------------------------------------------------+
|  Account Authentication                                           [X] |
+-----------------------------------------------------------------------+
|  Quick Demo Fill: [Participant Account]   [Administrator Account]     |
|                                                                       |
|  [  Sign In  ]   [  Create Free Account  ]                            |
|  -----------------------------------------                            |
|  Email Address                                                        |
|  +-----------------------------------------------------------------+  |
|  | rohit.mehta@example.com                                         |  |
|  +-----------------------------------------------------------------+  |
|                                                                       |
|  Account Password                                                     |
|  +-----------------------------------------------------------------+  |
|  | •••••••••••••••••••••                                           |  |
|  +-----------------------------------------------------------------+  |
|                                                                       |
|  [   Sign In to StratosEvent   ]                                      |
|                                                                       |
|  Security Notice: Passwords are protected via Bcrypt hashing (cost 10)|
|  and JWT session signatures. Server strictly enforces RBAC.           |
+-----------------------------------------------------------------------+
```

---

## 3. Screen 3: Event Details & Reservation Modal
**Implemented Component**: Event Detail Modal (`frontend/index.html` `#eventDetailModal`)  
**Purpose**: Displays technical event specifications, venue instructions, and atomic seat reservation action.

```text
+-----------------------------------------------------------------------+
|  Event Details: Cloud Native Architecture & Kubernetes            [X] |
+-----------------------------------------------------------------------+
|  [Workshop Badge]                               Reference: #EVT-001   |
|                                                                       |
|  Hands-on deep dive into building, deploying, and scaling micro-      |
|  services with Docker and Kubernetes in production environments.      |
|                                                                       |
|  +-----------------------------------------------------------------+  |
|  | Schedule: Nov 05, 2026 • 09:30 AM - 05:00 PM                     |  |
|  | Venue: Auditorium 1, Synergy Tech Park, Hyderabad               |  |
|  | Seat Capacity: 60 Max Attendees (57 Seats Available)           |  |
|  | Concurrency Guard: Row-Level Database Lock Protected            |  |
|  +-----------------------------------------------------------------+  |
|                                                                       |
|  [!] Live Database Record: Synchronized from stratosevent_db.         |
|      Registration capacity locked via POST /api/registrations.        |
|                                                                       |
|  [ Close ]                              [ Confirm Seat Reservation ]  |
+-----------------------------------------------------------------------+
```

---

## 4. Screen 4: Verified Admission Ticket Pass Modal
**Implemented Component**: Ticket Confirmation Modal (`frontend/index.html` `#ticketModal`)  
**Purpose**: Renders the unique cryptographic ticket code issued upon database commit.

```text
+-----------------------------------------------------------------------+
|  [V] Seat Reserved Successfully!                                  [X] |
+-----------------------------------------------------------------------+
|                                                                       |
|  OFFICIAL BOOKING PASS                                                |
|  Cloud Native Architecture & Kubernetes Workshop                      |
|  [ Confirmed • approved ]                                             |
|                                                                       |
|  +-----------------------------------------------------------------+  |
|  | YOUR UNIQUE TICKET CODE                                         |  |
|  | SE-1-3-MVFBH6Z7-705FFA                                          |  |
|  +-----------------------------------------------------------------+  |
|                                                                       |
|  Attendee: Rohit Mehta (rohit.mehta@example.com)                      |
|  Seat reserved via MySQL transactional lock. Show pass at check-in.   |
|                                                                       |
|  [ Close ]                                [ View All My Bookings ]    |
+-----------------------------------------------------------------------+
```

---

## 5. Screen 5: Participant Booking History & Cancellation Modal
**Implemented Component**: My Bookings Modal (`frontend/index.html` `#myBookingsModal`)  
**Purpose**: Participant self-service roster to inspect active passes and execute cancellations.

```text
+-----------------------------------------------------------------------------------------------+
|  My Event Registrations                                                                   [X] |
+-----------------------------------------------------------------------------------------------+
|  Event                  Schedule             Ticket Code             Status      Action       |
|  -------------------------------------------------------------------------------------------  |
|  Cloud Native Workshop  Nov 05 • 09:30 AM    SE-1-3-MVFBH6Z7-705FFA  [APPROVED]  [ Cancel ]   |
|  Synergy Tech Park                                                                            |
|                                                                                               |
|  NextGen AI Webinar     Nov 12 • 03:00 PM    TKT-STR-2026-0004       [APPROVED]  [ Cancel ]   |
|  Online Webex Session                                                                         |
|                                                                                               |
|  [ Done ]                                                                                     |
+-----------------------------------------------------------------------------------------------+
```

---

## 6. Screen 6: Administrator Console — Registration Approvals
**Implemented Component**: Admin Console Tab 1 (`#admin-pane-regs`)  
**Purpose**: Event attendee roster inspection and one-click moderation (Approve / Reject).

```text
+-----------------------------------------------------------------------------------------------+
|  HAWKINS PROTOCOL • Admin Control Console                                                 [X] |
+-----------------------------------------------------------------------------------------------+
|  [ Approvals (Active) ]   [ Gate Scanner ]   [ Create Event ]   [ Analytics & Reports ]       |
|  -------------------------------------------------------------------------------------------  |
|  Select Event: [#EVT-001: Cloud Native Architecture & Kubernetes Workshop]   [ Refresh ]      |
|                                                                                               |
|  Attendee             Ticket Code             Registration Date   Status      Actions         |
|  -------------------------------------------------------------------------------------------  |
|  Rohit Mehta          SE-1-3-MVFBH6Z7-705FFA  10/20/2026          [APPROVED]  [ Reject ]      |
|  rohit.mehta@example                                                                          |
|                                                                                               |
|  Manish Joshi         TKT-STR-2026-0006       10/18/2026          [PENDING]   [Approve][Reject|
|  manish.j@example.com                                                                         |
|                                                                                               |
|  [ Close Console ]                                                                            |
+-----------------------------------------------------------------------------------------------+
```

---

## 7. Screen 7: Administrator Console — Gate Check-In & Scanner
**Implemented Component**: Admin Console Tab 2 (`#admin-pane-checkin`)  
**Purpose**: Fast gate ticket inspection, authenticity check, and duplicate check-in prevention.

```text
+-----------------------------------------------------------------------------------------------+
|  HAWKINS PROTOCOL • Admin Control Console                                                 [X] |
+-----------------------------------------------------------------------------------------------+
|  [ Approvals ]   [ Gate Scanner (Active) ]   [ Create Event ]   [ Analytics & Reports ]       |
|  -------------------------------------------------------------------------------------------  |
|  +-------------------------------------+ +--------------------------------------------------+ |
|  | VERIFY ADMISSION PASS               | | INSPECTION RESULT: VALID PASS • READY FOR ENTRY  | |
|  | Unique Ticket Code                  | | Ticket Code: TKT-STR-2026-0001                   | |
|  | [ TKT-STR-2026-0001               ] | | Event: Cloud Native Architecture Workshop        | |
|  | Gate Notes (Optional)               | | Attendee: Rohit Mehta (rohit.mehta@example.com)  | |
|  | [ Gate 1, Badge issued            ] | | Registration Status: [ APPROVED ]                | |
|  | [  Inspect Ticket Pass  ]           | |                                                  | |
|  |                                     | | [  Admit Attendee (Confirm Gate Check-In)  ]     | |
|  +-------------------------------------+ +--------------------------------------------------+ |
|  [ Close Console ]                                                                            |
+-----------------------------------------------------------------------------------------------+
```

---

## 8. Screen 8: Executive Analytics & Reporting Dashboard
**Implemented Component**: Admin Console Tab 4 (`#admin-pane-analytics`)  
**Purpose**: Real-time KPI summary cards, event-wise capacity utilization table, and CSV export.

```text
+-----------------------------------------------------------------------------------------------+
|  HAWKINS PROTOCOL • Admin Control Console                                                 [X] |
+-----------------------------------------------------------------------------------------------+
|  [ Approvals ]   [ Gate Scanner ]   [ Create Event ]   [ Analytics & Reports (Active) ]       |
|  -------------------------------------------------------------------------------------------  |
|  Executive Intelligence & Reporting               [ Refresh ]  [ Export Roster (CSV) ]        |
|  Calculated strictly from genuine MySQL records                                               |
|                                                                                               |
|  +-------------------+ +-------------------+ +--------------------+ +-----------------------+ |
|  | TOTAL EVENTS      | | REGISTRATIONS     | | CHECK-IN RATIO     | | CAPACITY UTILIZATION  | |
|  | 5                 | | 7                 | | 50.0%              | | 1.4%                  | |
|  | 4 Pub • 1 Draft   | | 6 App • 1 Pen     | | 3 Admitted / 6 App | | 7 Booked • 503 Free   | |
|  +-------------------+ +-------------------+ +--------------------+ +-----------------------+ |
|                                                                                               |
|  EVENT-WISE ATTENDANCE & CAPACITY UTILIZATION                                                 |
|  Event Title            Capacity  Registered  Checked-In  Capacity Used  Att Rate  Remaining  |
|  -------------------------------------------------------------------------------------------  |
|  Cloud Native Workshop  60        3           3 Admitted  [== 5.0%]      100%      57 Free    |
|  NextGen AI Webinar     250       2           0 Admitted  [=  0.8%]      0%        248 Free   |
|  CodeStorm Hackathon    120       2           0 Admitted  [=  1.7%]      0%        118 Free   |
|                                                                                               |
|  PARTICIPANT DOMAIN DISTRIBUTION                      CONTACT COVERAGE                        |
|  @example.com           5 Users [======]              100.0% Users have verified phone number |
|  @stratosevent.internal 2 Users [==    ]              for urgent notifications.               |
|                                                                                               |
|  [ Close Console ]                                                                            |
+-----------------------------------------------------------------------------------------------+
```
