// Frontend API client with backend field mapping

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const CATEGORY_ICONS = {
  Streetlight: "💡",
  Footpath: "🚶",
  "Public Transport": "🚌",
  "Road Damage": "🚧",
  Accessibility: "♿",
  Other: "📍",
};

/**
 * Returns a persistent anonymous supporter ID for this browser.
 * Stored under localStorage key 'shemaps-supporter-id'.
 */
export function getSupporterId() {
  let id = localStorage.getItem("shemaps-supporter-id");
  if (!id) {
    id = "sup_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
    localStorage.setItem("shemaps-supporter-id", id);
  }
  return id;
}

/**
 * Maps backend response format (supportCount, camelCase) to frontend UI issue format (reports, icon).
 */
export function mapBackendIssueToFrontend(item) {
  if (!item) return null;
  const count = Number(item.supportCount ?? item.reports ?? 1);
  return {
    id: item.id,
    title: item.title,
    description: item.description || "",
    category: item.category,
    location: item.location,
    severity: item.severity,
    status: item.status,
    latitude: item.latitude !== null && item.latitude !== undefined ? Number(item.latitude) : null,
    longitude: item.longitude !== null && item.longitude !== undefined ? Number(item.longitude) : null,
    reports: count,
    supportCount: count,
    supported: Boolean(item.supported),
    icon: CATEGORY_ICONS[item.category] || "📍",
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    daysPending: Number(item.daysPending ?? 0),
    priorityScore: Number(item.priorityScore ?? 0),
    isSample: Boolean(item.isSample),
  };
}

/**
 * Internal fetch wrapper with custom error attaching status and details.
 */
async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    ...options,
  });

  let data;
  const contentType = response.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    data = await response.json();
  } else {
    data = await response.text();
  }

  if (!response.ok) {
    const message =
      (typeof data === "object" && data !== null && (data.error || data.message)) ||
      `Request failed with status ${response.status}`;
    const error = new Error(message);
    error.status = response.status;
    error.details = typeof data === "object" && data !== null ? data.details || null : null;
    throw error;
  }

  return data;
}

/**
 * Fetch all issues from the backend API.
 */
export async function fetchIssues() {
  const supporterId = getSupporterId();
  const data = await apiRequest(`/issues?supporterId=${encodeURIComponent(supporterId)}`);
  return Array.isArray(data) ? data.map(mapBackendIssueToFrontend) : [];
}

/**
 * Create a new issue report.
 */
export async function createIssue(issueData) {
  const supporterId = getSupporterId();
  const location =
    issueData.location && String(issueData.location).trim()
      ? String(issueData.location).trim()
      : "Pinned location";

  const payload = {
    title: issueData.title,
    description: issueData.description || null,
    category: issueData.category,
    location,
    severity: issueData.severity,
    latitude: issueData.latitude ?? null,
    longitude: issueData.longitude ?? null,
    supporterId,
  };

  const created = await apiRequest("/issues", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  return mapBackendIssueToFrontend(created);
}

/**
 * Support an issue ("I face this too").
 */
export async function supportIssue(id) {
  const supporterId = getSupporterId();
  const updated = await apiRequest(`/issues/${id}/support`, {
    method: "POST",
    body: JSON.stringify({ supporterId }),
  });
  return mapBackendIssueToFrontend(updated);
}

/**
 * Update an issue's status.
 */
export async function updateStatus(id, status) {
  const updated = await apiRequest(`/issues/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
  return mapBackendIssueToFrontend(updated);
}

/**
 * Fetch city dashboard analytics from the backend API.
 */
export async function fetchDashboard() {
  return await apiRequest("/dashboard");
}

/**
 * Reverse geocode latitude and longitude to a human-readable address using Nominatim OpenStreetMap.
 */
export async function reverseGeocode(lat, lng) {
  try {
    const params = new URLSearchParams({
      format: "jsonv2",
      lat: String(lat),
      lon: String(lng),
      zoom: "18",
      addressdetails: "1",
    });

    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?${params}`
    );

    if (!response.ok) {
      throw new Error("Address lookup failed");
    }

    const data = await response.json();
    return data.display_name || null;
  } catch {
    return null;
  }
}

