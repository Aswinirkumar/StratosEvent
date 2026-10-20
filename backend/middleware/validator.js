/**
 * Input Validation Middleware & Helpers
 * StratosEvent - Event Management Platform
 */

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ALLOWED_EVENT_TYPES = ['workshop', 'webinar', 'conference', 'hackathon', 'seminar'];
const ALLOWED_EVENT_STATUSES = ['draft', 'published', 'completed', 'cancelled'];
const ALLOWED_REG_STATUSES = ['pending', 'approved', 'rejected', 'cancelled'];
const ALLOWED_ATTENDANCE_STATUSES = ['checked_in', 'absent', 'late'];

/**
 * Validate user registration payload.
 */
function validateRegister(req, res, next) {
  const { full_name, email, password, phone_number } = req.body;
  const errors = [];

  if (!full_name || typeof full_name !== 'string' || full_name.trim().length < 2) {
    errors.push('Full name is required and must be at least 2 characters long.');
  }

  if (!email || typeof email !== 'string' || !EMAIL_REGEX.test(email.trim())) {
    errors.push('A valid email address is required.');
  }

  if (!password || typeof password !== 'string' || password.length < 6) {
    errors.push('Password is required and must be at least 6 characters long.');
  } else if (password.length > 128) {
    errors.push('Password cannot exceed 128 characters.');
  }

  if (phone_number && (typeof phone_number !== 'string' || phone_number.trim().length > 20)) {
    errors.push('Phone number cannot exceed 20 characters.');
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid registration input.',
        details: errors,
      },
    });
  }

  // Sanitize input and ensure any client-supplied role is discarded
  req.body.full_name = full_name.trim();
  req.body.email = email.trim().toLowerCase();
  delete req.body.role;
  next();
}

/**
 * Validate user login payload.
 */
function validateLogin(req, res, next) {
  const { email, password } = req.body;
  const errors = [];

  if (!email || typeof email !== 'string' || !EMAIL_REGEX.test(email.trim())) {
    errors.push('A valid email address is required.');
  }

  if (!password || typeof password !== 'string') {
    errors.push('Password is required.');
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid login credentials provided.',
        details: errors,
      },
    });
  }

  req.body.email = email.trim().toLowerCase();
  next();
}

/**
 * Validate event creation and update payload.
 */
function validateEvent(isUpdate = false) {
  return (req, res, next) => {
    const { title, description, event_type, start_time, end_time, venue, capacity, status } = req.body;
    const errors = [];

    if (!isUpdate || title !== undefined) {
      if (!title || typeof title !== 'string' || title.trim().length < 3) {
        errors.push('Event title is required and must be at least 3 characters long.');
      }
    }

    if (event_type !== undefined || !isUpdate) {
      if (!event_type || !ALLOWED_EVENT_TYPES.includes(event_type)) {
        errors.push(`Event type must be one of: [${ALLOWED_EVENT_TYPES.join(', ')}].`);
      }
    }

    let parsedStart, parsedEnd;
    if (start_time !== undefined || !isUpdate) {
      parsedStart = new Date(start_time);
      if (!start_time || isNaN(parsedStart.getTime())) {
        errors.push('A valid start_time (ISO or YYYY-MM-DD HH:mm:ss) is required.');
      }
    }

    if (end_time !== undefined || !isUpdate) {
      parsedEnd = new Date(end_time);
      if (!end_time || isNaN(parsedEnd.getTime())) {
        errors.push('A valid end_time (ISO or YYYY-MM-DD HH:mm:ss) is required.');
      }
    }

    if (parsedStart && parsedEnd && parsedEnd < parsedStart) {
      errors.push('Event end_time must be greater than or equal to start_time.');
    }

    if (!isUpdate || venue !== undefined) {
      if (!venue || typeof venue !== 'string' || venue.trim().length < 2) {
        errors.push('Venue is required (physical location or webinar meeting URL).');
      }
    }

    if (!isUpdate || capacity !== undefined) {
      const parsedCapacity = parseInt(capacity, 10);
      if (isNaN(parsedCapacity) || parsedCapacity <= 0) {
        errors.push('Capacity must be a positive integer greater than zero.');
      }
    }

    if (status !== undefined) {
      if (!ALLOWED_EVENT_STATUSES.includes(status)) {
        errors.push(`Status must be one of: [${ALLOWED_EVENT_STATUSES.join(', ')}].`);
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid event data.',
          details: errors,
        },
      });
    }

    next();
  };
}

module.exports = {
  EMAIL_REGEX,
  ALLOWED_EVENT_TYPES,
  ALLOWED_EVENT_STATUSES,
  ALLOWED_REG_STATUSES,
  ALLOWED_ATTENDANCE_STATUSES,
  validateRegister,
  validateLogin,
  validateEvent,
};
