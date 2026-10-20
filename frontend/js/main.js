/**
 * StratosEvent — Client-Side Logic & Dynamic Event Discovery
 * Enterprise Event Management & Registration Platform
 * 
 * Features:
 * 1. Dynamic rendering of demonstration event cards with vector fallback banners
 * 2. Real-time search and category filtering
 * 3. Graceful backend API detection (http://localhost:5000/api/events)
 * 4. Transparent event preview and authentication notices without mock persistence
 */

// -------------------------------------------------------------------------
// 1. Backend Configuration & Sample Demonstration Data
// -------------------------------------------------------------------------

// Planned backend API endpoint (activated when backend/server.js is running)
const API_BASE_URL = 'http://localhost:5000/api';

/**
 * Realistic demonstration events representing sample database records.
 * Directly mirrors database/schema.sql and database/seed.sql.
 */
const DEMO_EVENTS = [
  {
    id: 1,
    title: 'Cloud Native Architecture & Kubernetes Workshop',
    description: 'Hands-on deep dive into building, deploying, and scaling microservices with Docker and Kubernetes in production environments.',
    category: 'workshop',
    dateFormatted: 'Nov 05, 2026 • 09:30 AM - 05:00 PM',
    venue: 'Auditorium 1, Synergy Tech Park, Hyderabad',
    capacity: 60,
    sampleRegistered: 42,
    icon: 'bi-cpu',
    bannerClass: 'banner-workshop',
    badgeClass: 'badge-workshop',
  },
  {
    id: 2,
    title: 'NextGen AI & LLM Systems Webinar',
    description: 'Exploring enterprise applications of generative AI, prompt engineering, and ethical AI deployment in modern software.',
    category: 'webinar',
    dateFormatted: 'Nov 12, 2026 • 03:00 PM - 06:00 PM',
    venue: 'Online • Virtual Cisco Webex Session',
    capacity: 250,
    sampleRegistered: 180,
    icon: 'bi-camera-video',
    bannerClass: 'banner-webinar',
    badgeClass: 'badge-webinar',
  },
  {
    id: 3,
    title: 'Stratos Annual CodeStorm Hackathon 2026',
    description: 'A 24-hour rapid product innovation hackathon focused on FinTech, HealthTech, and GreenTech problem statements.',
    category: 'hackathon',
    dateFormatted: 'Nov 20-21, 2026 • Starts 08:00 AM',
    venue: 'Innovation Hub, Tech Park Phase 2, Bengaluru',
    capacity: 120,
    sampleRegistered: 95,
    icon: 'bi-lightning-charge',
    bannerClass: 'banner-hackathon',
    badgeClass: 'badge-hackathon',
  },
  {
    id: 4,
    title: 'Cybersecurity & Zero Trust Architecture Seminar',
    description: 'Industry leaders discuss defense-in-depth strategies, vulnerability assessment, and compliance in cloud infrastructure.',
    category: 'seminar',
    dateFormatted: 'Dec 02, 2026 • 10:00 AM - 01:30 PM',
    venue: 'Conference Hall B, Siruseri IT Park, Chennai',
    capacity: 80,
    sampleRegistered: 50,
    icon: 'bi-shield-check',
    bannerClass: 'banner-seminar',
    badgeClass: 'badge-seminar',
  },
  {
    id: 5,
    title: 'Enterprise Tech Leadership & Cloud Summit',
    description: 'Annual gathering of IT directors, engineering managers, and cloud architects sharing case studies on scaling resilient platforms.',
    category: 'conference',
    dateFormatted: 'Dec 08-09, 2026 • 09:00 AM - 05:00 PM',
    venue: 'Grand Ballroom, Hitec City Convention Centre, Hyderabad',
    capacity: 300,
    sampleRegistered: 215,
    icon: 'bi-people',
    bannerClass: 'banner-conference',
    badgeClass: 'badge-conference',
  },
  {
    id: 6,
    title: 'Full-Stack JavaScript Mastery Bootcamp',
    description: 'Intensive code-along covering Node.js event loops, Express RESTful architecture, MySQL transactional safety, and Bootstrap 5.',
    category: 'workshop',
    dateFormatted: 'Dec 15, 2026 • 10:00 AM - 04:30 PM',
    venue: 'Online • Interactive Microsoft Teams Session',
    capacity: 150,
    sampleRegistered: 88,
    icon: 'bi-code-slash',
    bannerClass: 'banner-workshop',
    badgeClass: 'badge-workshop',
  },
];

// Event type styling mappings
const EVENT_TYPE_MAP = {
  workshop: { icon: 'bi-cpu', banner: 'banner-workshop', badge: 'badge-workshop' },
  webinar: { icon: 'bi-camera-video', banner: 'banner-webinar', badge: 'badge-webinar' },
  conference: { icon: 'bi-people', banner: 'banner-conference', badge: 'badge-conference' },
  hackathon: { icon: 'bi-lightning-charge', banner: 'banner-hackathon', badge: 'badge-hackathon' },
  seminar: { icon: 'bi-shield-check', banner: 'banner-seminar', badge: 'badge-seminar' },
};

/**
 * Format date and time ranges from ISO strings into user-friendly display.
 */
function formatEventDate(start, end) {
  if (!start) return '';
  try {
    const s = new Date(start);
    if (isNaN(s.getTime())) return String(start);

    const dateStr = s.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    const startTimeStr = s.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });

    if (!end) return `${dateStr} • ${startTimeStr}`;

    const e = new Date(end);
    if (isNaN(e.getTime())) return `${dateStr} • ${startTimeStr}`;

    const endTimeStr = e.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });

    return `${dateStr} • ${startTimeStr} - ${endTimeStr}`;
  } catch {
    return String(start);
  }
}

// Current active event dataset in memory
let currentEvents = [...DEMO_EVENTS];

// User session state
let currentUser = null;
let authToken = null;
let myRegisteredEventIds = new Set();

try {
  currentUser = JSON.parse(localStorage.getItem('stratos_user') || 'null');
  authToken = localStorage.getItem('stratos_token') || null;
} catch {
  currentUser = null;
  authToken = null;
}

/**
 * Synchronizes user's confirmed registration IDs from the database.
 */
async function syncUserRegistrations() {
  if (!authToken) {
    myRegisteredEventIds.clear();
    return;
  }
  try {
    const res = await fetch(`${API_BASE_URL}/registrations/my`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.registrations)) {
        myRegisteredEventIds = new Set(
          data.registrations
            .filter((r) => r.status !== 'cancelled')
            .map((r) => r.event_id)
        );
      }
    }
  } catch {
    // Ignore fetch error
  }
}

// -------------------------------------------------------------------------
// 2. DOM Elements Cache & Modal Instances
// -------------------------------------------------------------------------
let searchInput;
let categorySelect;
let eventsContainer;
let resultsCountElement;
let statusNoticeElement;
let eventModalInstance;
let authModalInstance;
let ticketModalInstance;
let myBookingsModalInstance;
let adminModalInstance;

// -------------------------------------------------------------------------
// 3. Application Initialization
// -------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', async () => {
  // Bind UI inputs
  searchInput = document.getElementById('eventSearch');
  categorySelect = document.getElementById('categoryFilter');
  eventsContainer = document.getElementById('eventsContainer');
  resultsCountElement = document.getElementById('resultsCount');
  statusNoticeElement = document.getElementById('statusNotice');

  // Initialize Bootstrap modals
  const eventModalEl = document.getElementById('eventDetailModal');
  if (eventModalEl && typeof bootstrap !== 'undefined') {
    eventModalInstance = new bootstrap.Modal(eventModalEl);
  }

  const authModalEl = document.getElementById('authNoticeModal');
  if (authModalEl && typeof bootstrap !== 'undefined') {
    authModalInstance = new bootstrap.Modal(authModalEl);
  }

  const ticketModalEl = document.getElementById('ticketModal');
  if (ticketModalEl && typeof bootstrap !== 'undefined') {
    ticketModalInstance = new bootstrap.Modal(ticketModalEl);
  }

  const myBookingsModalEl = document.getElementById('myBookingsModal');
  if (myBookingsModalEl && typeof bootstrap !== 'undefined') {
    myBookingsModalInstance = new bootstrap.Modal(myBookingsModalEl);
  }

  const adminModalEl = document.getElementById('adminConsoleModal');
  if (adminModalEl && typeof bootstrap !== 'undefined') {
    adminModalInstance = new bootstrap.Modal(adminModalEl);
  }

  // Attach input listeners
  if (searchInput) {
    searchInput.addEventListener('input', applyFilters);
  }
  if (categorySelect) {
    categorySelect.addEventListener('change', applyFilters);
  }

  // Sync existing user registrations first
  await syncUserRegistrations();

  // Update navbar with user login state
  updateAuthUI();

  // Attempt to load events (connects to live backend if available)
  loadEvents();
});

// -------------------------------------------------------------------------
// 4. Data Loading (Backend API with Fallback)
// -------------------------------------------------------------------------
/**
 * Asynchronously loads events from http://localhost:5000/api/events.
 * Populates real records from stratosevent_db with fallback to demo data if offline.
 */
async function loadEvents() {
  try {
    const response = await fetch(`${API_BASE_URL}/events`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    });

    if (response.ok) {
      const data = await response.json();
      const rawEvents = Array.isArray(data) ? data : (data.events || []);

      if (rawEvents.length > 0) {
        currentEvents = rawEvents.map((e) => {
          const type = (e.event_type || e.category || 'workshop').toLowerCase();
          const meta = EVENT_TYPE_MAP[type] || EVENT_TYPE_MAP.workshop;
          const capacity = Number(e.capacity || 0);
          const registered = Number(e.registered_count || e.sampleRegistered || 0);
          const available = e.available_seats !== undefined ? Number(e.available_seats) : Math.max(0, capacity - registered);

          return {
            id: e.id,
            title: e.title,
            description: e.description || '',
            category: type,
            dateFormatted: formatEventDate(e.start_time, e.end_time) || e.dateFormatted || 'Schedule TBA',
            venue: e.venue || 'Venue TBA',
            capacity,
            sampleRegistered: registered,
            availableSeats: available,
            status: e.status || 'published',
            creatorName: e.creator_name || 'System Administrator',
            icon: meta.icon,
            bannerClass: meta.banner,
            badgeClass: meta.badge,
            isLive: true,
          };
        });

        updateDataSourceBadge('Live MySQL Database Connected', 'success');
        renderEvents(currentEvents);
        return;
      }
    }
  } catch (error) {
    console.info(`[StratosEvent] Backend API notice: ${error.message}. Operating in demonstration mode.`);
  }

  // Fallback to demonstration data
  currentEvents = [...DEMO_EVENTS];
  updateDataSourceBadge('Demonstration Data', 'secondary');
  renderEvents(currentEvents);
}

/**
 * Updates UI badge indicating data source state.
 */
function updateDataSourceBadge(modeText, theme) {
  if (statusNoticeElement) {
    const badgeBg = theme === 'success' ? 'bg-success-subtle text-success-emphasis border-success-subtle' : 'bg-light text-secondary border';
    const icon = theme === 'success' ? 'bi-database-check text-success' : 'bi-info-circle text-secondary';
    
    statusNoticeElement.innerHTML = `
      <span class="badge ${badgeBg} border px-2.5 py-1.5 fw-medium d-inline-flex align-items-center gap-1.5">
        <i class="bi ${icon}"></i>
        <span>${modeText}</span>
      </span>
    `;
  }
}

// -------------------------------------------------------------------------
// 5. Dynamic Event Card Rendering
// -------------------------------------------------------------------------
/**
 * Renders event cards into the catalog container.
 * @param {Array} events - Filtered event objects.
 */
function renderEvents(events) {
  if (!eventsContainer) return;

  // Clear previous cards
  eventsContainer.innerHTML = '';

  // Update results counter (accessible live region)
  if (resultsCountElement) {
    resultsCountElement.textContent = `Showing ${events.length} of ${currentEvents.length} events`;
  }

  // Handle empty state
  if (events.length === 0) {
    eventsContainer.innerHTML = `
      <div class="col-12">
        <div class="card p-5 text-center bg-white border border-secondary-subtle rounded-3">
          <div class="mb-3 text-secondary">
            <i class="bi bi-search display-6"></i>
          </div>
          <h3 class="h5 fw-bold text-dark mb-1">No Matching Events Found</h3>
          <p class="text-muted small mb-3">Try adjusting your keyword search or category filter to discover available sessions.</p>
          <div>
            <button type="button" class="btn btn-outline-primary btn-sm px-3" onclick="resetFilters()">
              <i class="bi bi-arrow-counterclockwise me-1"></i> Reset Filters
            </button>
          </div>
        </div>
      </div>
    `;
    return;
  }

  // Build card markup
  events.forEach((event) => {
    const cardCol = document.createElement('div');
    cardCol.className = 'col-md-6 col-lg-4';

    const categoryBadge = getBadgeMarkup(event.category);
    const bannerClass = event.bannerClass || 'banner-workshop';
    const iconClass = event.icon || 'bi-calendar-event';
    const capacityTotal = event.capacity || 100;
    const sampleRegistered = event.sampleRegistered || 0;
    const availableSeats = event.availableSeats !== undefined ? event.availableSeats : Math.max(0, capacityTotal - sampleRegistered);
    const capacityPct = capacityTotal > 0 ? Math.min(Math.round((sampleRegistered / capacityTotal) * 100), 100) : 0;

    let seatBadge = '';
    if (availableSeats <= 0) {
      seatBadge = '<span class="badge bg-danger text-white border-0 font-monospace">SOLD OUT</span>';
    } else if (availableSeats <= 10) {
      seatBadge = `<span class="badge bg-warning-subtle text-warning border border-warning-subtle font-monospace">${availableSeats} SEATS LEFT</span>`;
    } else {
      seatBadge = `<span class="badge bg-success-subtle text-success border border-success-subtle font-monospace">${availableSeats} / ${capacityTotal} FREE</span>`;
    }

    cardCol.innerHTML = `
      <article class="event-card">
        <!-- Visual Vector Banner Header (Fallback Image Replacement) -->
        <div class="event-card-banner ${bannerClass}">
          <i class="bi ${iconClass} banner-watermark" aria-hidden="true"></i>
          <div class="banner-chips">
            ${categoryBadge}
            <span class="card-id-chip">#EVT-00${event.id}</span>
          </div>
        </div>

        <!-- Event Body Information -->
        <div class="event-card-content">
          <h3 class="event-card-title">${escapeHTML(event.title)}</h3>
          <p class="event-card-desc">${escapeHTML(event.description)}</p>
          
          <div class="event-card-meta">
            <i class="bi bi-calendar3" aria-hidden="true"></i>
            <span>${escapeHTML(event.dateFormatted)}</span>
          </div>
          <div class="event-card-meta">
            <i class="bi bi-geo-alt" aria-hidden="true"></i>
            <span class="text-truncate">${escapeHTML(event.venue)}</span>
          </div>

          <!-- Capacity Progress Indicator -->
          <div class="capacity-container">
            <div class="capacity-header d-flex justify-content-between align-items-center mb-1">
              <span class="text-uppercase" style="font-size: 0.7rem; letter-spacing: 0.05em;">Seat Availability</span>
              <div>${seatBadge}</div>
            </div>
            <div class="capacity-progress" role="progressbar" aria-valuenow="${capacityPct}" aria-valuemin="0" aria-valuemax="100" aria-label="${availableSeats} of ${capacityTotal} seats available">
              <div class="capacity-progress-bar" style="width: ${capacityPct}%"></div>
            </div>
          </div>
        </div>

        <!-- Card Action Footer -->
        <div class="event-card-action">
          <button 
            type="button" 
            class="btn ${availableSeats <= 0 ? 'btn-outline-secondary' : 'btn-outline-primary'} btn-sm w-100 py-2 fw-bold" 
            onclick="openEventModal(${event.id})"
            aria-label="View details and register for ${escapeHTML(event.title)}"
          >
            <i class="bi bi-ticket-perforated me-1.5"></i> ${availableSeats <= 0 ? 'View Details (Sold Out)' : 'View Details &amp; Register'}
          </button>
        </div>
      </article>
    `;

    eventsContainer.appendChild(cardCol);
  });
}

// -------------------------------------------------------------------------
// 6. Search and Category Filtering
// -------------------------------------------------------------------------
/**
 * Filters event list based on search term and category dropdown.
 */
function applyFilters() {
  const searchTerm = searchInput ? searchInput.value.trim().toLowerCase() : '';
  const selectedCategory = categorySelect ? categorySelect.value.toLowerCase() : 'all';

  const filtered = currentEvents.filter((event) => {
    const matchesCategory = selectedCategory === 'all' || event.category.toLowerCase() === selectedCategory;

    const matchesSearch =
      searchTerm === '' ||
      event.title.toLowerCase().includes(searchTerm) ||
      event.description.toLowerCase().includes(searchTerm) ||
      event.venue.toLowerCase().includes(searchTerm);

    return matchesCategory && matchesSearch;
  });

  renderEvents(filtered);
}

/**
 * Resets search input and category filter.
 */
function resetFilters() {
  if (searchInput) searchInput.value = '';
  if (categorySelect) categorySelect.value = 'all';
  applyFilters();
}

// -------------------------------------------------------------------------
// 7. Modal Handlers (Honest Preview, No Fake Operations)
// -------------------------------------------------------------------------
/**
 * Opens event detail modal with comprehensive event specifications.
 */
function openEventModal(eventId) {
  const event = currentEvents.find((e) => e.id === eventId);
  if (!event) return;

  const titleEl = document.getElementById('modalEventTitle');
  const bodyEl = document.getElementById('modalEventBody');

  if (titleEl) {
    titleEl.textContent = event.title;
  }

  if (bodyEl) {
    bodyEl.innerHTML = `
      <div class="d-flex align-items-center justify-content-between mb-3">
        <div>${getBadgeMarkup(event.category)}</div>
        <span class="badge bg-light text-secondary border small">Reference: #EVT-00${event.id}</span>
      </div>

      <p class="text-secondary mb-3">${escapeHTML(event.description)}</p>

      <div class="bg-light p-3 rounded-2 border mb-3">
        <div class="row g-2 small">
          <div class="col-sm-6">
            <span class="text-muted d-block">Schedule</span>
            <strong class="text-dark"><i class="bi bi-calendar3 me-1 text-primary"></i> ${escapeHTML(event.dateFormatted)}</strong>
          </div>
          <div class="col-sm-6">
            <span class="text-muted d-block">Venue</span>
            <strong class="text-dark"><i class="bi bi-geo-alt me-1 text-danger"></i> ${escapeHTML(event.venue)}</strong>
          </div>
          <div class="col-sm-6 mt-2">
            <span class="text-muted d-block">Seat Capacity</span>
            <strong class="text-dark"><i class="bi bi-people me-1 text-info"></i> ${event.capacity} Max Attendees (${event.availableSeats !== undefined ? event.availableSeats : (event.capacity - (event.sampleRegistered || 0))} Available)</strong>
          </div>
          <div class="col-sm-6 mt-2">
            <span class="text-muted d-block">Integrity Rule</span>
            <strong class="text-dark"><i class="bi bi-shield-check me-1 text-success"></i> Transactional Lock Protected</strong>
          </div>
        </div>
      </div>

      <div id="modalEventAlert" class="d-none"></div>

      <div class="alert alert-success d-flex align-items-start gap-2 mb-0 border" role="status">
        <i class="bi bi-database-check text-success mt-0.5 fs-5"></i>
        <div class="small">
          <strong>Live Database Record:</strong> This event is synchronized directly from your MySQL database (<code>stratosevent_db</code>).
          Registration capacity is protected by <code>POST /api/registrations</code> using row-level locking.
        </div>
      </div>
    `;
  }

  // Update dynamic modal action button based on auth & registration state
  const actionContainer = document.getElementById('modalActionContainer');
  const isAlreadyBooked = myRegisteredEventIds.has(event.id);

  if (actionContainer) {
    if (!currentUser) {
      actionContainer.innerHTML = `
        <button 
          type="button" 
          class="btn btn-primary btn-sm px-3" 
          data-bs-dismiss="modal"
          onclick="openAuthModal('participant')"
        >
          <i class="bi bi-box-arrow-in-right me-1"></i> Sign In to Reserve
        </button>
      `;
    } else if (isAlreadyBooked) {
      // User already holds a seat
      const alertBox = document.getElementById('modalEventAlert');
      if (alertBox) {
        alertBox.className = 'alert alert-info py-2.5 px-3 small mb-3 border d-flex align-items-center justify-content-between';
        alertBox.innerHTML = `
          <div><i class="bi bi-check-circle-fill text-success me-1.5"></i> You already hold a confirmed ticket for this session.</div>
          <button type="button" class="btn btn-xs btn-outline-primary" data-bs-dismiss="modal" onclick="openMyBookingsModal()">View Pass</button>
        `;
      }
      actionContainer.innerHTML = `
        <button 
          type="button" 
          class="btn btn-outline-primary btn-sm px-3" 
          data-bs-dismiss="modal"
          onclick="openMyBookingsModal()"
        >
          <i class="bi bi-ticket-perforated me-1"></i> View My Confirmed Pass
        </button>
      `;
    } else {
      actionContainer.innerHTML = `
        <button 
          type="button" 
          class="btn btn-success btn-sm px-3" 
          id="confirmReserveBtn"
          onclick="confirmReservation(${event.id})"
        >
          <i class="bi bi-ticket-perforated me-1"></i> Confirm Seat Reservation
        </button>
      `;
    }
  }

  if (eventModalInstance) {
    eventModalInstance.show();
  }
}

/**
 * Confirms event registration via POST /api/registrations with Bearer token.
 */
async function confirmReservation(eventId) {
  if (!authToken) {
    if (eventModalInstance) eventModalInstance.hide();
    openAuthModal('participant');
    return;
  }

  const btn = document.getElementById('confirmReserveBtn');
  const alertBox = document.getElementById('modalEventAlert');

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1" role="status"></span> Reserving...';
  }

  try {
    const res = await fetch(`${API_BASE_URL}/registrations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ event_id: eventId }),
    });

    const data = await res.json();

    if (res.ok && data.success) {
      myRegisteredEventIds.add(eventId);

      if (eventModalInstance) eventModalInstance.hide();

      // Display ticket confirmation pass
      const ticketBody = document.getElementById('ticketModalBody');
      if (ticketBody) {
        ticketBody.innerHTML = `
          <div class="card border-0 bg-light p-3 mb-3 text-center">
            <span class="text-muted small text-uppercase fw-semibold mb-1">Official Booking Pass</span>
            <h4 class="h5 fw-bold text-dark mb-1">${escapeHTML(data.registration.event_title)}</h4>
            <div class="my-2">
              <span class="badge bg-success-subtle text-success border border-success px-2.5 py-1">
                <i class="bi bi-check-circle-fill me-1"></i> Confirmed • ${escapeHTML(data.registration.status)}
              </span>
            </div>
            <div class="bg-white border rounded-3 p-3 my-2 text-center">
              <span class="text-muted small d-block mb-1">Your Unique Ticket Code</span>
              <code class="fs-5 fw-bold text-primary">${escapeHTML(data.registration.ticket_code)}</code>
            </div>
            <div class="small text-muted mt-1">
              Attendee: <strong>${escapeHTML(currentUser.full_name)}</strong> (${escapeHTML(currentUser.email)})
            </div>
          </div>
          <p class="small text-muted text-center mb-0">
            <i class="bi bi-shield-check text-success me-1"></i> Seat reserved via MySQL transactional lock. Show this pass at event check-in.
          </p>
        `;
      }

      if (ticketModalInstance) {
        ticketModalInstance.show();
      }

      // Reload events to reflect decremented seat availability
      loadEvents();
    } else {
      const errorMsg = data.error ? data.error.message : 'Registration failed.';

      if (data.error && data.error.code === 'DUPLICATE_REGISTRATION') {
        myRegisteredEventIds.add(eventId);
        if (alertBox) {
          alertBox.className = 'alert alert-info py-2 px-3 small mb-3 border d-block';
          alertBox.innerHTML = `
            <div class="d-flex align-items-center justify-content-between">
              <div><i class="bi bi-info-circle-fill text-primary me-1"></i> You are already registered for this event.</div>
              <button type="button" class="btn btn-xs btn-outline-primary" data-bs-dismiss="modal" onclick="openMyBookingsModal()">View Pass</button>
            </div>
          `;
        }
        if (btn) {
          btn.disabled = false;
          btn.className = 'btn btn-outline-primary btn-sm px-3';
          btn.innerHTML = '<i class="bi bi-ticket-perforated me-1"></i> View My Confirmed Pass';
          btn.onclick = () => {
            if (eventModalInstance) eventModalInstance.hide();
            openMyBookingsModal();
          };
        }
      } else {
        if (alertBox) {
          alertBox.className = 'alert alert-warning py-2 px-3 small mb-3 border d-block';
          alertBox.innerHTML = `<i class="bi bi-exclamation-triangle-fill me-1"></i> ${escapeHTML(errorMsg)}`;
        }
        if (btn) {
          btn.disabled = false;
          btn.innerHTML = '<i class="bi bi-ticket-perforated me-1"></i> Confirm Seat Reservation';
        }
      }
    }
  } catch (error) {
    if (alertBox) {
      alertBox.className = 'alert alert-danger py-2 px-3 small mb-3 border d-block';
      alertBox.innerHTML = `<i class="bi bi-wifi-off me-1"></i> Connection failed: ${escapeHTML(error.message)}`;
    }
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i class="bi bi-ticket-perforated me-1"></i> Confirm Seat Reservation';
    }
  }
}

/**
 * Updates navbar authentication container based on active user state.
 */
function updateAuthUI() {
  const container = document.getElementById('navAuthSection');
  if (!container) return;

  if (currentUser && authToken) {
    const isParticipant = currentUser.role === 'participant';
    const roleBadgeClass = isParticipant ? 'bg-primary-subtle text-primary border-primary-subtle' : 'bg-danger-subtle text-danger border-danger-subtle';
    const iconClass = isParticipant ? 'bi-person-circle text-primary' : 'bi-shield-lock-fill text-danger';

    container.innerHTML = `
      <div class="d-flex align-items-center gap-2">
        ${isParticipant ? `
          <button type="button" class="btn btn-outline-primary btn-sm px-2.5 shadow-none" onclick="openMyBookingsModal()">
            <i class="bi bi-ticket-perforated me-1"></i> My Bookings
          </button>
        ` : `
          <button type="button" class="btn btn-outline-danger btn-sm px-2.5 shadow-none" onclick="openAdminModal()">
            <i class="bi bi-speedometer2 me-1"></i> Admin Console
          </button>
        `}
        <div class="dropdown">
          <button class="btn btn-light btn-sm border dropdown-toggle d-flex align-items-center gap-1.5" type="button" data-bs-toggle="dropdown" aria-expanded="false">
            <i class="bi ${iconClass}"></i>
            <span class="fw-medium">${escapeHTML(currentUser.full_name)}</span>
            <span class="badge ${roleBadgeClass} border ms-1 text-uppercase" style="font-size: 0.65rem;">${escapeHTML(currentUser.role)}</span>
          </button>
          <ul class="dropdown-menu dropdown-menu-end shadow-sm">
            <li><h6 class="dropdown-header text-truncate" style="max-width: 220px;">${escapeHTML(currentUser.email)}</h6></li>
            ${isParticipant ? `
              <li><button class="dropdown-item" onclick="openMyBookingsModal()"><i class="bi bi-ticket-perforated me-2"></i>View Passes</button></li>
            ` : `
              <li><button class="dropdown-item" onclick="openAdminModal()"><i class="bi bi-speedometer2 me-2 text-danger"></i>Admin Console</button></li>
            `}
            <li><hr class="dropdown-divider"></li>
            <li><button class="dropdown-item text-danger" onclick="logout()"><i class="bi bi-box-arrow-right me-2"></i>Sign Out</button></li>
          </ul>
        </div>
      </div>
    `;
  } else {
    container.innerHTML = `
      <button 
        type="button" 
        class="btn btn-outline-secondary btn-sm px-3" 
        onclick="openAuthModal('participant')"
        aria-label="Open participant login"
      >
        <i class="bi bi-box-arrow-in-right me-1.5" aria-hidden="true"></i> Login
      </button>
      <button 
        type="button" 
        class="btn btn-primary btn-sm px-3 shadow-none" 
        onclick="openAuthModal('admin')"
        aria-label="Open administrator access"
      >
        <i class="bi bi-shield-lock me-1.5" aria-hidden="true"></i> Admin Portal
      </button>
    `;
  }
}

/**
 * Populates demo credentials into the login form inputs.
 */
function fillDemoCredentials(role) {
  const emailInput = document.getElementById('loginEmail');
  const passInput = document.getElementById('loginPassword');
  const alertEl = document.getElementById('authAlert');

  // Activate Sign In tab
  const loginTabBtn = document.getElementById('login-tab');
  if (loginTabBtn && typeof bootstrap !== 'undefined') {
    const tab = new bootstrap.Tab(loginTabBtn);
    tab.show();
  }

  if (role === 'admin') {
    if (emailInput) emailInput.value = 'admin@stratosevent.internal';
    if (passInput) passInput.value = 'StratosDev@2026';
  } else {
    if (emailInput) emailInput.value = 'rohit.mehta@example.com';
    if (passInput) passInput.value = 'StratosDev@2026';
  }

  if (alertEl) {
    alertEl.className = 'alert alert-info py-2 px-3 small mb-3 border';
    alertEl.innerHTML = `<i class="bi bi-info-circle me-1"></i> Demo credentials loaded for <strong>${role}</strong>. Click "Sign In" below!`;
  }
}

/**
 * Handles login form submission (POST /api/auth/login).
 */
async function handleLoginSubmit(e) {
  e.preventDefault();
  const email = document.getElementById('loginEmail')?.value.trim();
  const password = document.getElementById('loginPassword')?.value;
  const alertEl = document.getElementById('authAlert');
  const btn = document.getElementById('loginSubmitBtn');

  if (!email || !password) return;

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1" role="status"></span> Signing In...';
  }

  try {
    const res = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();

    if (res.ok && data.success) {
      authToken = data.token;
      currentUser = data.user;
      localStorage.setItem('stratos_token', data.token);
      localStorage.setItem('stratos_user', JSON.stringify(data.user));

      if (authModalInstance) {
        authModalInstance.hide();
      }

      updateAuthUI();
      loadEvents();
    } else {
      if (alertEl) {
        alertEl.className = 'alert alert-danger py-2 px-3 small mb-3 border';
        alertEl.innerHTML = `<i class="bi bi-exclamation-triangle-fill me-1"></i> ${data.error ? data.error.message : 'Invalid login credentials.'}`;
      }
    }
  } catch (error) {
    if (alertEl) {
      alertEl.className = 'alert alert-danger py-2 px-3 small mb-3 border';
      alertEl.innerHTML = `<i class="bi bi-exclamation-triangle-fill me-1"></i> Failed to connect to server: ${error.message}`;
    }
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i class="bi bi-box-arrow-in-right me-1"></i> Sign In to StratosEvent';
    }
  }
}

/**
 * Handles participant account registration (POST /api/auth/register).
 */
async function handleRegisterSubmit(e) {
  e.preventDefault();
  const fullName = document.getElementById('regFullName')?.value.trim();
  const email = document.getElementById('regEmail')?.value.trim();
  const password = document.getElementById('regPassword')?.value;
  const phone = document.getElementById('regPhone')?.value.trim();
  const alertEl = document.getElementById('authAlert');
  const btn = document.getElementById('registerSubmitBtn');

  if (!fullName || !email || !password) return;

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1" role="status"></span> Creating Account...';
  }

  try {
    const res = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        full_name: fullName,
        email,
        password,
        phone_number: phone || null,
        role: 'participant',
      }),
    });

    const data = await res.json();

    if (res.ok && data.success) {
      authToken = data.token;
      currentUser = data.user;
      localStorage.setItem('stratos_token', data.token);
      localStorage.setItem('stratos_user', JSON.stringify(data.user));

      if (authModalInstance) {
        authModalInstance.hide();
      }

      updateAuthUI();
      loadEvents();
    } else {
      if (alertEl) {
        alertEl.className = 'alert alert-danger py-2 px-3 small mb-3 border';
        alertEl.innerHTML = `<i class="bi bi-exclamation-triangle-fill me-1"></i> ${data.error ? data.error.message : 'Registration failed.'}`;
      }
    }
  } catch (error) {
    if (alertEl) {
      alertEl.className = 'alert alert-danger py-2 px-3 small mb-3 border';
      alertEl.innerHTML = `<i class="bi bi-exclamation-triangle-fill me-1"></i> Failed to connect to server: ${error.message}`;
    }
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i class="bi bi-person-plus me-1"></i> Create Free Account';
    }
  }
}

/**
 * Logs out the current user and clears session state.
 */
function logout() {
  localStorage.removeItem('stratos_token');
  localStorage.removeItem('stratos_user');
  authToken = null;
  currentUser = null;
  updateAuthUI();
  loadEvents();
}

/**
 * Opens authentication modal with tab selected.
 */
function openAuthModal(role) {
  if (role === 'admin' && currentUser && currentUser.role === 'admin') {
    openAdminModal();
    return;
  }

  const alertEl = document.getElementById('authAlert');
  if (alertEl) alertEl.className = 'd-none';

  if (role) {
    fillDemoCredentials(role);
  }

  if (authModalInstance) {
    authModalInstance.show();
  }
}

/**
 * Opens My Bookings modal and fetches user's registrations (GET /api/registrations/my).
 */
async function openMyBookingsModal() {
  if (!authToken) {
    openAuthModal('participant');
    return;
  }

  const bodyEl = document.getElementById('myBookingsBody');
  if (bodyEl) {
    bodyEl.innerHTML = `
      <div class="text-center py-4">
        <div class="spinner-border spinner-border-sm text-primary" role="status"></div>
        <p class="small text-muted mt-2">Loading your registration passes...</p>
      </div>
    `;
  }

  if (myBookingsModalInstance) {
    myBookingsModalInstance.show();
  }

  try {
    const res = await fetch(`${API_BASE_URL}/registrations/my`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });

    const data = await res.json();

    if (res.ok && data.success) {
      const regs = data.registrations || [];

      if (regs.length === 0) {
        bodyEl.innerHTML = `
          <div class="text-center py-4 text-muted">
            <i class="bi bi-ticket-perforated display-6 d-block mb-2 text-secondary"></i>
            <h5 class="fw-bold text-dark mb-1">No Event Bookings Found</h5>
            <p class="small mb-3">You haven't registered for any events yet. Explore events on the home page to reserve your seat!</p>
          </div>
        `;
        return;
      }

      bodyEl.innerHTML = `
        <div class="table-responsive">
          <table class="table table-hover align-middle mb-0">
            <thead class="table-light small">
              <tr>
                <th>Event</th>
                <th>Schedule</th>
                <th>Ticket Code</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody class="small">
              ${regs.map((r) => `
                <tr>
                  <td>
                    <strong>${escapeHTML(r.event_title)}</strong>
                    <div class="text-muted small">${escapeHTML(r.venue)}</div>
                  </td>
                  <td>${escapeHTML(formatEventDate(r.start_time, r.end_time))}</td>
                  <td><code class="fw-bold text-primary">${escapeHTML(r.ticket_code)}</code></td>
                  <td>
                    <span class="badge ${r.status === 'approved' ? 'bg-success-subtle text-success border border-success-subtle' : 'bg-secondary-subtle text-secondary'} text-uppercase">
                      ${escapeHTML(r.status)}
                    </span>
                  </td>
                  <td>
                    ${r.status === 'approved' ? `
                      <button type="button" class="btn btn-outline-danger btn-xs py-0.5 px-2 small" onclick="cancelRegistration(${r.id})">
                        Cancel
                      </button>
                    ` : `<span class="text-muted small">—</span>`}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    } else {
      bodyEl.innerHTML = `<div class="alert alert-danger small mb-0">${data.error ? data.error.message : 'Failed to load bookings.'}</div>`;
    }
  } catch (error) {
    bodyEl.innerHTML = `<div class="alert alert-danger small mb-0">Error fetching bookings: ${error.message}</div>`;
  }
}

/**
 * Cancels a user's registration and frees their seat.
 */
async function cancelRegistration(regId) {
  if (!confirm('Are you sure you want to cancel this registration? Your seat will be released.')) {
    return;
  }

  try {
    const res = await fetch(`${API_BASE_URL}/registrations/${regId}/cancel`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${authToken}` },
    });

    const data = await res.json();

    if (res.ok && data.success) {
      openMyBookingsModal();
      loadEvents();
    } else {
      alert(`Notice: ${data.error ? data.error.message : 'Cancellation failed.'}`);
    }
  } catch (error) {
    alert(`Network Error: ${error.message}`);
  }
}

// -------------------------------------------------------------------------
// 8. Helper Utilities
// -------------------------------------------------------------------------
/**
 * Returns styled category badge markup.
 */
function getBadgeMarkup(category) {
  const cat = (category || 'workshop').toLowerCase();
  const classMap = {
    workshop: 'badge-workshop',
    webinar: 'badge-webinar',
    conference: 'badge-conference',
    hackathon: 'badge-hackathon',
    seminar: 'badge-seminar',
  };

  const badgeClass = classMap[cat] || 'badge-seminar';
  const label = cat.charAt(0).toUpperCase() + cat.slice(1);

  return `<span class="card-category-badge ${badgeClass}">${label}</span>`;
}

/**
 * Escapes HTML characters to prevent XSS.
 */
function escapeHTML(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// -------------------------------------------------------------------------
// 9. Administrator Control Console Handlers
// -------------------------------------------------------------------------
/**
 * Opens the Administrator Control Console modal.
 */
function openAdminModal() {
  if (!authToken || !currentUser || currentUser.role !== 'admin') {
    openAuthModal('admin');
    return;
  }

  // Populate event dropdown in admin console
  const selector = document.getElementById('adminEventSelector');
  if (selector) {
    selector.innerHTML = '<option value="">-- Choose an Event --</option>';
    currentEvents.forEach((ev) => {
      const opt = document.createElement('option');
      opt.value = ev.id;
      opt.textContent = `#EVT-00${ev.id}: ${ev.title} (${ev.category})`;
      selector.appendChild(opt);
    });

    if (currentEvents.length > 0) {
      selector.value = currentEvents[0].id;
      handleAdminEventChange();
    }
  }

  if (adminModalInstance) {
    adminModalInstance.show();
  }
}

/**
 * Loads registrations for the selected event in admin console (GET /api/registrations?event_id=...).
 */
async function handleAdminEventChange() {
  const selector = document.getElementById('adminEventSelector');
  const container = document.getElementById('adminRegsTableContainer');
  const alertEl = document.getElementById('adminRegsAlert');
  if (alertEl) alertEl.className = 'd-none';

  if (!selector || !container) return;
  const eventId = selector.value;
  if (!eventId) {
    container.innerHTML = '<div class="text-center py-4 text-muted small">Please select an event above to inspect participant bookings.</div>';
    return;
  }

  container.innerHTML = `
    <div class="text-center py-4">
      <div class="spinner-border spinner-border-sm text-danger" role="status"></div>
      <p class="small text-muted mt-2">Loading registrations roster...</p>
    </div>
  `;

  try {
    const res = await fetch(`${API_BASE_URL}/registrations?event_id=${eventId}`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    const data = await res.json();

    if (res.ok && data.success) {
      const regs = data.registrations || [];
      if (regs.length === 0) {
        container.innerHTML = `
          <div class="text-center py-4 text-muted small">
            <i class="bi bi-inbox display-6 d-block mb-2 text-secondary opacity-50"></i>
            No registrations found for this event yet.
          </div>
        `;
        return;
      }

      container.innerHTML = `
        <div class="table-responsive">
          <table class="table table-hover align-middle mb-0">
            <thead class="table-light small">
              <tr>
                <th>Attendee</th>
                <th>Ticket Code</th>
                <th>Registered Date</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody class="small">
              ${regs.map((r) => {
                const statusBadge = r.status === 'approved' 
                  ? 'bg-success-subtle text-success border border-success-subtle' 
                  : (r.status === 'pending' ? 'bg-warning-subtle text-warning border border-warning-subtle' : 'bg-danger-subtle text-danger');
                return `
                  <tr>
                    <td>
                      <strong>${escapeHTML(r.participant_name || 'Anonymous')}</strong>
                      <div class="text-muted small">${escapeHTML(r.participant_email || '')} ${r.phone_number ? '• ' + escapeHTML(r.phone_number) : ''}</div>
                    </td>
                    <td><code class="fw-bold text-primary">${escapeHTML(r.ticket_code)}</code></td>
                    <td>${new Date(r.registration_date).toLocaleDateString()}</td>
                    <td><span class="badge ${statusBadge} text-uppercase">${escapeHTML(r.status)}</span></td>
                    <td>
                      <div class="btn-group btn-group-sm">
                        ${r.status !== 'approved' ? `
                          <button class="btn btn-outline-success btn-xs px-2 py-0.5" onclick="updateRegistrationStatus(${r.id}, 'approved', ${eventId})" title="Approve Registration">
                            <i class="bi bi-check-lg"></i> Approve
                          </button>
                        ` : ''}
                        ${r.status !== 'rejected' && r.status !== 'cancelled' ? `
                          <button class="btn btn-outline-danger btn-xs px-2 py-0.5" onclick="updateRegistrationStatus(${r.id}, 'rejected', ${eventId})" title="Reject Registration">
                            <i class="bi bi-x-lg"></i> Reject
                          </button>
                        ` : ''}
                      </div>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      `;
    } else {
      container.innerHTML = `<div class="alert alert-danger small m-3">${data.error ? data.error.message : 'Failed to load registrations.'}</div>`;
    }
  } catch (err) {
    container.innerHTML = `<div class="alert alert-danger small m-3">Error: ${escapeHTML(err.message)}</div>`;
  }
}

/**
 * Updates a registration's status (PATCH /api/registrations/:id/status).
 */
async function updateRegistrationStatus(regId, newStatus, eventId) {
  try {
    const res = await fetch(`${API_BASE_URL}/registrations/${regId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ status: newStatus }),
    });

    const data = await res.json();
    if (res.ok && data.success) {
      handleAdminEventChange();
      loadEvents();
    } else {
      alert(`Update Failed: ${data.error ? data.error.message : 'Unknown error'}`);
    }
  } catch (err) {
    alert(`Error: ${err.message}`);
  }
}

/**
 * Verifies an attendee's ticket before gate admission (GET /api/attendance/verify/:ticketCode).
 */
async function handleAdminVerifyTicket(e) {
  e.preventDefault();
  const input = document.getElementById('checkinTicketCode');
  const resultCard = document.getElementById('ticketInspectResult');
  const btn = document.getElementById('verifyTicketBtn');
  if (!input || !resultCard) return;

  const ticketCode = input.value.trim();
  if (!ticketCode) return;

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1" role="status"></span> Verifying...';
  }

  try {
    const res = await fetch(`${API_BASE_URL}/attendance/verify/${encodeURIComponent(ticketCode)}`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    const data = await res.json();

    if (res.ok && data.success) {
      const t = data.ticket;
      const isCheckedIn = t.is_already_checked_in;

      resultCard.innerHTML = `
        <div class="border rounded-3 p-3 bg-light">
          <div class="d-flex align-items-center justify-content-between mb-2">
            <span class="badge ${isCheckedIn ? 'bg-danger text-white' : 'bg-success text-white'} text-uppercase px-2.5 py-1">
              <i class="bi ${isCheckedIn ? 'bi-x-octagon' : 'bi-check-circle'} me-1"></i>
              ${isCheckedIn ? 'Already Checked In' : 'Valid Pass • Ready for Entry'}
            </span>
            <code class="fw-bold">${escapeHTML(t.ticket_code)}</code>
          </div>
          <h5 class="fw-bold text-dark mb-1">${escapeHTML(t.event_title)}</h5>
          <div class="small text-muted mb-3"><i class="bi bi-geo-alt me-1 text-danger"></i>${escapeHTML(t.venue)}</div>

          <div class="card p-3 border-0 bg-white shadow-sm mb-3">
            <div class="small"><span class="text-muted">Attendee:</span> <strong>${escapeHTML(t.participant_name)}</strong></div>
            <div class="small"><span class="text-muted">Email:</span> ${escapeHTML(t.participant_email)}</div>
            <div class="small"><span class="text-muted">Registration Status:</span> <span class="badge bg-success-subtle text-success text-uppercase">${escapeHTML(t.registration_status)}</span></div>
          </div>

          ${isCheckedIn ? `
            <div class="alert alert-warning small mb-0 border">
              <i class="bi bi-exclamation-triangle-fill me-1"></i>
              <strong>Duplicate Check-In Warning:</strong> This attendee was checked in at 
              <code>${new Date(t.attendance.check_in_time).toLocaleString()}</code>
              by <strong>${escapeHTML(t.attendance.verified_by || 'Staff')}</strong>.
            </div>
          ` : `
            <button type="button" class="btn btn-success btn-sm w-100 py-2 fw-bold" onclick="confirmCheckIn('${escapeHTML(t.ticket_code)}')">
              <i class="bi bi-check2-circle me-1"></i> Admit Attendee (Confirm Gate Check-In)
            </button>
          `}
        </div>
      `;
    } else {
      resultCard.innerHTML = `
        <div class="alert alert-danger small mb-0">
          <i class="bi bi-exclamation-triangle-fill me-1"></i>
          <strong>Ticket Verification Error:</strong> ${data.error ? data.error.message : 'Invalid ticket.'}
        </div>
      `;
    }
  } catch (err) {
    resultCard.innerHTML = `<div class="alert alert-danger small mb-0">Error: ${escapeHTML(err.message)}</div>`;
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i class="bi bi-search me-1"></i> Inspect Ticket Pass';
    }
  }
}

/**
 * Confirms check-in for a verified attendee (POST /api/attendance/check-in).
 */
async function confirmCheckIn(ticketCode) {
  const notesInput = document.getElementById('checkinNotes');
  const resultCard = document.getElementById('ticketInspectResult');
  const notes = notesInput ? notesInput.value.trim() : '';

  try {
    const res = await fetch(`${API_BASE_URL}/attendance/check-in`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ ticket_code: ticketCode, notes: notes || 'Gate Check-In' }),
    });

    const data = await res.json();
    if (res.ok && data.success) {
      if (resultCard) {
        resultCard.innerHTML = `
          <div class="alert alert-success p-3 border mb-0 text-center">
            <i class="bi bi-check-circle-fill text-success display-6 d-block mb-2"></i>
            <h5 class="fw-bold mb-1">Check-In Confirmed!</h5>
            <p class="small text-muted mb-2">Attendee <strong>${escapeHTML(data.attendance.participant_name)}</strong> admitted to <em>${escapeHTML(data.attendance.event_title)}</em>.</p>
            <div class="badge bg-success font-monospace px-2.5 py-1">Code: ${escapeHTML(data.attendance.ticket_code)}</div>
          </div>
        `;
      }
      const codeInput = document.getElementById('checkinTicketCode');
      if (codeInput) codeInput.value = '';
    } else {
      alert(`Check-in error: ${data.error ? data.error.message : 'Failed'}`);
    }
  } catch (err) {
    alert(`Error: ${err.message}`);
  }
}

/**
 * Handles publishing a new event from admin console (POST /api/events).
 */
async function handleCreateEventSubmit(e) {
  e.preventDefault();
  const alertEl = document.getElementById('adminCreateEventAlert');
  const btn = document.getElementById('adminCreateEventBtn');

  const title = document.getElementById('eventNewTitle')?.value.trim();
  const event_type = document.getElementById('eventNewType')?.value;
  const start_time = document.getElementById('eventNewStart')?.value;
  const end_time = document.getElementById('eventNewEnd')?.value;
  const venue = document.getElementById('eventNewVenue')?.value.trim();
  const capacity = document.getElementById('eventNewCapacity')?.value;
  const description = document.getElementById('eventNewDesc')?.value.trim();

  if (!title || !event_type || !start_time || !end_time || !venue || !capacity) {
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1" role="status"></span> Publishing...';
  }

  try {
    const res = await fetch(`${API_BASE_URL}/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        title,
        event_type,
        start_time,
        end_time,
        venue,
        capacity: parseInt(capacity, 10),
        description,
        status: 'published',
      }),
    });

    const data = await res.json();
    if (res.ok && data.success) {
      if (alertEl) {
        alertEl.className = 'alert alert-success py-2 px-3 small mb-3 border';
        alertEl.innerHTML = `<i class="bi bi-check-circle-fill me-1"></i> Event <strong>${escapeHTML(data.event.title)}</strong> successfully published to catalog!`;
      }
      document.getElementById('adminCreateEventForm')?.reset();
      loadEvents();
    } else {
      if (alertEl) {
        alertEl.className = 'alert alert-danger py-2 px-3 small mb-3 border';
        alertEl.innerHTML = `<i class="bi bi-exclamation-triangle-fill me-1"></i> ${data.error ? data.error.message : 'Event creation failed.'}`;
      }
    }
  } catch (err) {
    if (alertEl) {
      alertEl.className = 'alert alert-danger py-2 px-3 small mb-3 border';
      alertEl.innerHTML = `<i class="bi bi-wifi-off me-1"></i> Network error: ${escapeHTML(err.message)}`;
    }
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i class="bi bi-cloud-arrow-up me-1.5"></i> Publish Event to StratosEvent';
    }
  }
}

// -------------------------------------------------------------------------
// 10. Real-Time Analytics & Business Intelligence Engine
// -------------------------------------------------------------------------
/**
 * Loads real-time executive analytics and business intelligence from /api/analytics.
 */
async function loadAdminAnalytics() {
  const container = document.getElementById('analyticsContentContainer');
  if (!container) return;

  container.innerHTML = `
    <div class="text-center py-5">
      <div class="spinner-border spinner-border-sm text-danger" role="status"></div>
      <p class="small text-muted mt-2">Computing real-time analytics from stratosevent_db...</p>
    </div>
  `;

  try {
    const [overviewRes, eventsRes] = await Promise.all([
      fetch(`${API_BASE_URL}/analytics/overview`, {
        headers: { Authorization: `Bearer ${authToken}` },
      }),
      fetch(`${API_BASE_URL}/analytics/events`, {
        headers: { Authorization: `Bearer ${authToken}` },
      }),
    ]);

    const overviewData = await overviewRes.json();
    const eventsData = await eventsRes.json();

    if (!overviewRes.ok || !overviewData.success || !eventsRes.ok || !eventsData.success) {
      container.innerHTML = `
        <div class="alert alert-danger small m-3">
          Failed to load analytics: ${overviewData.error ? overviewData.error.message : 'Unauthorized or internal error'}
        </div>
      `;
      return;
    }

    const m = overviewData.metrics;
    const evs = eventsData.events || [];

    container.innerHTML = `
      <!-- Top KPI Metric Cards -->
      <div class="row g-3 mb-4">
        <div class="col-sm-6 col-xl-3">
          <div class="card border-0 shadow-sm p-3 bg-white h-100 border-start border-4 border-primary">
            <div class="text-uppercase text-muted fw-bold" style="font-size: 0.7rem; letter-spacing: 0.05em;">Total Events</div>
            <div class="h3 fw-bold text-dark my-1">${m.events.total}</div>
            <div class="small text-muted">
              <span class="text-success fw-semibold">${m.events.published} Published</span> • 
              <span class="text-secondary">${m.events.draft} Draft</span>
            </div>
          </div>
        </div>

        <div class="col-sm-6 col-xl-3">
          <div class="card border-0 shadow-sm p-3 bg-white h-100 border-start border-4 border-success">
            <div class="text-uppercase text-muted fw-bold" style="font-size: 0.7rem; letter-spacing: 0.05em;">Total Registrations</div>
            <div class="h3 fw-bold text-dark my-1">${m.registrations.total}</div>
            <div class="small text-muted">
              <span class="text-success fw-semibold">${m.registrations.approved} Approved</span> • 
              <span class="text-warning fw-semibold">${m.registrations.pending} Pending</span>
            </div>
          </div>
        </div>

        <div class="col-sm-6 col-xl-3">
          <div class="card border-0 shadow-sm p-3 bg-white h-100 border-start border-4 border-danger">
            <div class="text-uppercase text-muted fw-bold" style="font-size: 0.7rem; letter-spacing: 0.05em;">Check-In Confirmation</div>
            <div class="h3 fw-bold text-dark my-1">${m.attendance.confirmation_ratio_percentage}%</div>
            <div class="small text-muted">
              <span class="text-danger fw-semibold">${m.attendance.total_checked_in} Admitted</span> of ${m.registrations.approved} Approved
            </div>
          </div>
        </div>

        <div class="col-sm-6 col-xl-3">
          <div class="card border-0 shadow-sm p-3 bg-white h-100 border-start border-4 border-info">
            <div class="text-uppercase text-muted fw-bold" style="font-size: 0.7rem; letter-spacing: 0.05em;">Capacity Utilization</div>
            <div class="h3 fw-bold text-dark my-1">${m.capacity.utilization_percentage}%</div>
            <div class="small text-muted">
              <span class="text-primary fw-semibold">${m.capacity.active_reservations} Booked</span> • ${m.capacity.remaining_seats} Seats Free
            </div>
          </div>
        </div>
      </div>

      <!-- Event-Level Performance Table -->
      <div class="card border-0 shadow-sm bg-white mb-4">
        <div class="card-header bg-white py-3 border-bottom d-flex align-items-center justify-content-between">
          <h6 class="fw-bold text-dark mb-0"><i class="bi bi-table me-2 text-danger"></i>Event-Wise Attendance &amp; Capacity Utilization</h6>
          <span class="badge bg-light text-secondary border small">${evs.length} Events Evaluated</span>
        </div>
        <div class="table-responsive">
          <table class="table table-hover align-middle mb-0">
            <thead class="table-light small">
              <tr>
                <th>Event Title</th>
                <th>Category</th>
                <th>Capacity</th>
                <th>Registrations</th>
                <th>Check-Ins</th>
                <th>Capacity Used</th>
                <th>Attendance Rate</th>
                <th>Remaining</th>
              </tr>
            </thead>
            <tbody class="small">
              ${evs.map((e) => `
                <tr>
                  <td>
                    <strong class="text-dark">${escapeHTML(e.title)}</strong>
                    <div class="text-muted small">${escapeHTML(e.venue)}</div>
                  </td>
                  <td><span class="badge ${getBadgeMarkup(e.event_type).includes('workshop') ? 'bg-primary-subtle text-primary' : 'bg-secondary-subtle text-secondary'} text-uppercase">${escapeHTML(e.event_type)}</span></td>
                  <td><strong>${e.capacity}</strong></td>
                  <td>
                    <span class="text-dark fw-semibold">${e.registered_count}</span>
                    <span class="text-muted small">(${e.approved_count} app / ${e.pending_count} pen)</span>
                  </td>
                  <td><span class="badge bg-danger-subtle text-danger fw-bold">${e.checked_in_count} Admitted</span></td>
                  <td style="min-width: 120px;">
                    <div class="d-flex align-items-center gap-2">
                      <div class="progress flex-grow-1" style="height: 6px;">
                        <div class="progress-bar bg-primary" role="progressbar" style="width: ${e.capacity_utilization_pct}%;" aria-valuenow="${e.capacity_utilization_pct}" aria-valuemin="0" aria-valuemax="100"></div>
                      </div>
                      <span class="small fw-semibold text-muted">${e.capacity_utilization_pct}%</span>
                    </div>
                  </td>
                  <td>
                    <span class="badge ${e.attendance_rate_pct >= 50 ? 'bg-success-subtle text-success' : 'bg-warning-subtle text-warning'} border">
                      ${e.attendance_rate_pct}%
                    </span>
                  </td>
                  <td><span class="fw-bold ${e.remaining_seats <= 10 ? 'text-danger' : 'text-success'}">${e.remaining_seats} Free</span></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Demographic Insights (From genuinely collected attributes) -->
      <div class="row g-3">
        <div class="col-md-7">
          <div class="card border-0 shadow-sm p-3 bg-white h-100">
            <h6 class="fw-bold text-dark mb-1"><i class="bi bi-envelope-at me-2 text-primary"></i>Participant Domain Distribution</h6>
            <p class="text-muted small mb-3">Aggregated strictly from attendee registration emails in stratosevent_db.</p>
            <div class="list-group list-group-flush small">
              ${m.demographics.top_email_domains.map((d) => `
                <div class="list-group-item d-flex justify-content-between align-items-center px-0 py-2">
                  <div>
                    <i class="bi bi-globe2 me-2 text-secondary"></i>
                    <strong>@${escapeHTML(d.domain)}</strong>
                  </div>
                  <span class="badge bg-secondary-subtle text-dark rounded-pill">${d.count} Users</span>
                </div>
              `).join('')}
            </div>
          </div>
        </div>

        <div class="col-md-5">
          <div class="card border-0 shadow-sm p-3 bg-white h-100">
            <h6 class="fw-bold text-dark mb-1"><i class="bi bi-telephone-check me-2 text-success"></i>Contact Completeness</h6>
            <p class="text-muted small mb-3">Presence of direct phone contact details across registered profiles.</p>
            <div class="d-flex align-items-center gap-3 my-auto py-2">
              <div class="display-6 fw-bold text-success">${m.demographics.phone_coverage_percentage}%</div>
              <div class="small text-muted">of user accounts provide direct contact numbers for SMS/event dispatch.</div>
            </div>
          </div>
        </div>
      </div>
    `;
  } catch (err) {
    container.innerHTML = `
      <div class="alert alert-danger small m-3">
        <i class="bi bi-wifi-off me-1"></i> Connection Error: ${escapeHTML(err.message)}
      </div>
    `;
  }
}

/**
 * Downloads authorized CSV roster report from /api/analytics/export/csv.
 */
async function downloadAnalyticsCSV() {
  if (!authToken) {
    openAuthModal('admin');
    return;
  }

  try {
    const res = await fetch(`${API_BASE_URL}/analytics/export/csv`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });

    if (!res.ok) {
      alert('Failed to generate CSV export. Please ensure you are logged in as an administrator.');
      return;
    }

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stratosevent_export_${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  } catch (err) {
    alert(`CSV Download Error: ${err.message}`);
  }
}
