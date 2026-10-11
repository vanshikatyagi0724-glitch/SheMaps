// Request validation helpers

export const ALLOWED_CATEGORIES = [
  "Streetlight",
  "Footpath",
  "Public Transport",
  "Road Damage",
  "Accessibility",
  "Other",
];

export const ALLOWED_SEVERITIES = ["High", "Medium", "Low"];

export const ALLOWED_STATUSES = ["Pending", "In Progress", "Resolved"];

export const ALLOWED_TRANSITIONS = {
  Pending: ["In Progress", "Resolved"],
  "In Progress": ["Resolved"],
  Resolved: ["In Progress"],
};

/**
 * Validates new issue creation payload
 * Returns { valid: boolean, errors?: Record<string, string>, cleaned?: object }
 */
export function validateCreateIssue(body) {
  const errors = {};

  if (!body || typeof body !== "object") {
    return { valid: false, errors: { body: "Request body must be a JSON object" } };
  }

  // 1. Title: required, 3-100 characters
  let title = body.title;
  if (typeof title !== "string" || !title.trim()) {
    errors.title = "Title is required and cannot be empty";
  } else {
    title = title.trim();
    if (title.length < 3 || title.length > 100) {
      errors.title = "Title must be between 3 and 100 characters";
    }
  }

  // 2. Description: optional, max 1000 characters
  let description = body.description;
  if (description !== undefined && description !== null) {
    if (typeof description !== "string") {
      errors.description = "Description must be a string";
    } else {
      description = description.trim();
      if (description.length > 1000) {
        errors.description = "Description cannot exceed 1000 characters";
      }
    }
  } else {
    description = null;
  }

  // 3. Category: required enum
  const category = body.category;
  if (!category || !ALLOWED_CATEGORIES.includes(category)) {
    errors.category = `Category must be one of: ${ALLOWED_CATEGORIES.join(", ")}`;
  }

  // 4. Location: required, 1-255 characters
  let location = body.location;
  if (typeof location !== "string" || !location.trim()) {
    errors.location = "Location is required and cannot be empty";
  } else {
    location = location.trim();
    if (location.length > 255) {
      errors.location = "Location cannot exceed 255 characters";
    }
  }

  // 5. Severity: required enum
  const severity = body.severity;
  if (!severity || !ALLOWED_SEVERITIES.includes(severity)) {
    errors.severity = `Severity must be one of: ${ALLOWED_SEVERITIES.join(", ")}`;
  }

  // 6. Latitude & Longitude: both-or-neither rule, valid range check
  let latitude = body.latitude;
  let longitude = body.longitude;

  const latPresent = latitude !== undefined && latitude !== null && latitude !== "";
  const lngPresent = longitude !== undefined && longitude !== null && longitude !== "";

  if (latPresent !== lngPresent) {
    errors.coordinates = "Both latitude and longitude must be provided together, or both omitted";
  } else if (latPresent && lngPresent) {
    latitude = Number(latitude);
    longitude = Number(longitude);

    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
      errors.latitude = "Latitude must be a valid number between -90 and 90";
    }
    if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      errors.longitude = "Longitude must be a valid number between -180 and 180";
    }
  } else {
    latitude = null;
    longitude = null;
  }

  let supporterId = body.supporterId;
  if (supporterId !== undefined && supporterId !== null && supporterId !== "") {
    if (typeof supporterId !== "string" || supporterId.trim().length < 8 || supporterId.trim().length > 64) {
      errors.supporterId = "Field 'supporterId' must be between 8 and 64 characters";
    } else {
      supporterId = supporterId.trim();
    }
  } else {
    supporterId = null;
  }

  if (Object.keys(errors).length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    cleaned: {
      title,
      description,
      category,
      location,
      severity,
      latitude,
      longitude,
      supporterId,
    },
  };
}

/**
 * Validates query parameters for GET /issues
 */
export function validateIssueFilters(query) {
  const errors = {};
  const { status, category, severity, supporterId } = query;

  if (status && status !== "" && !ALLOWED_STATUSES.includes(status)) {
    errors.status = `Invalid status filter. Allowed: ${ALLOWED_STATUSES.join(", ")}`;
  }

  if (category && category !== "" && !ALLOWED_CATEGORIES.includes(category)) {
    errors.category = `Invalid category filter. Allowed: ${ALLOWED_CATEGORIES.join(", ")}`;
  }

  if (severity && severity !== "" && !ALLOWED_SEVERITIES.includes(severity)) {
    errors.severity = `Invalid severity filter. Allowed: ${ALLOWED_SEVERITIES.join(", ")}`;
  }

  if (Object.keys(errors).length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    filters: {
      status: status || null,
      category: category || null,
      severity: severity || null,
      supporterId: supporterId ? String(supporterId).trim() : null,
    },
  };
}

/**
 * Validates support request payload
 */
export function validateSupportRequest(body) {
  const supporterId = body?.supporterId;
  if (!supporterId || typeof supporterId !== "string") {
    return {
      valid: false,
      errors: { supporterId: "Field 'supporterId' is required and must be a string" },
    };
  }

  const trimmed = supporterId.trim();
  if (trimmed.length < 8 || trimmed.length > 64) {
    return {
      valid: false,
      errors: { supporterId: "Field 'supporterId' must be between 8 and 64 characters" },
    };
  }

  return { valid: true, supporterId: trimmed };
}

/**
 * Validates status update transition
 */
export function validateStatusTransition(currentStatus, newStatus) {
  if (!newStatus || !ALLOWED_STATUSES.includes(newStatus)) {
    return {
      valid: false,
      statusCode: 400,
      message: `Invalid status. Allowed values: ${ALLOWED_STATUSES.join(", ")}`,
    };
  }

  if (currentStatus === newStatus) {
    return {
      valid: false,
      statusCode: 409,
      message: `Issue is already in status '${currentStatus}'`,
    };
  }

  const allowedNext = ALLOWED_TRANSITIONS[currentStatus] || [];
  if (!allowedNext.includes(newStatus)) {
    return {
      valid: false,
      statusCode: 400,
      message: `Invalid status transition from '${currentStatus}' to '${newStatus}'. Allowed: ${allowedNext.join(", ")}`,
    };
  }

  return { valid: true };
}
