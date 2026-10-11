# SheMaps — Frontend Integration Guide

Hey teammate! Here is everything you need to connect the frontend to the backend API, including the priority score and the City Dashboard.

The base URL is: `http://localhost:5000/api`

---

## 1. Helper Snippet: Persistent `supporterId` & API Fetcher

Add this small helper file or utility function in your frontend codebase:

```javascript
// src/api.js

export const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

// Generates a random anonymous ID (once) and keeps it in localStorage
export function getSupporterId() {
  let id = localStorage.getItem("shemaps-supporter-id");
  if (!id) {
    id = "sup_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
    localStorage.setItem("shemaps-supporter-id", id);
  }
  return id;
}

// Wrapper for easy fetch calls with error handling
export async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    ...options,
  });

  const data = await response.json();
  if (!response.ok) {
    const errorMsg = data.error || "An API error occurred";
    const err = new Error(errorMsg);
    err.details = data.details;
    err.status = response.status;
    throw err;
  }
  return data;
}
```

---

## 2. Priority Score & Formula

Every issue returned by `/api/issues` or `/api/dashboard` includes `priorityScore`, `daysPending`, and `isSample`.

### Formula:
$$\text{priorityScore} = (\text{severityWeight} \times 10) + (\text{supportCount} \times 2) + \text{daysPending}$$

- **severityWeight:**
  - `High` = 3 (contributes 30 points)
  - `Medium` = 2 (contributes 20 points)
  - `Low` = 1 (contributes 10 points)
- **supportCount:** Number of community supports (contributes 2 points each).
- **daysPending:** Whole days elapsed since `createdAt` (minimum 0).
- **isSample:** `true` if seeded initial data, `false` for user-reported issues.

---

## 3. UI Actions $\rightarrow$ API Mapping

### A. Load Community Issues List
**UI Action:** When the community reports view loads, filter changes, or sort changes.

```javascript
export async function fetchIssues() {
  const supporterId = getSupporterId();
  return await apiRequest(`/issues?supporterId=${encodeURIComponent(supporterId)}`);
}
```

**Issue Object Format:**
```json
{
  "id": 1,
  "title": "Broken streetlight near bus stop",
  "description": "Streetlight not functioning",
  "category": "Streetlight",
  "location": "Sector 14, Gurugram",
  "severity": "High",
  "status": "Pending",
  "latitude": 28.4720,
  "longitude": 77.0425,
  "supportCount": 12,
  "supported": false,
  "isSample": true,
  "daysPending": 12,
  "priorityScore": 66,
  "createdAt": "2026-09-30T01:50:00.000Z",
  "updatedAt": "2026-09-30T01:50:00.000Z"
}
```

### B. Submit a New Issue (`+ Report an Issue`)
**UI Action:** Form submission in the report modal.

```javascript
export async function createIssue(formData) {
  return await apiRequest("/issues", {
    method: "POST",
    body: JSON.stringify({
      title: formData.title,
      description: formData.description || null,
      category: formData.category,
      location: formData.location || "Pinned location",
      severity: formData.severity,
      latitude: formData.latitude ?? null,
      longitude: formData.longitude ?? null,
      supporterId: getSupporterId(),
    }),
  });
}
```

### C. Upvote an Issue (`"♡ I face this too"`)
**UI Action:** Clicking the support button on an issue card.

```javascript
export async function supportIssue(issueId) {
  return await apiRequest(`/issues/${issueId}/support`, {
    method: "POST",
    body: JSON.stringify({ supporterId: getSupporterId() }),
  });
}
```

### D. Update Status Dropdown
**UI Action:** Selecting a new status from the dropdown (`Pending`, `In Progress`, `Resolved`).

```javascript
export async function updateStatus(issueId, newStatus) {
  return await apiRequest(`/issues/${issueId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status: newStatus }),
  });
}
```

### E. Load City Dashboard Data
**UI Action:** Switching to the "City Dashboard" tab or clicking "Refresh Data".

```javascript
export async function fetchDashboard() {
  return await apiRequest("/dashboard");
}
```

---

## 4. `GET /api/dashboard` Response Structure

**Endpoint:** `GET /api/dashboard`

**Example Response:**
```json
{
  "totals": {
    "total": 4,
    "pending": 2,
    "inProgress": 1,
    "resolved": 1
  },
  "byCategory": [
    { "category": "Streetlight", "count": 1 },
    { "category": "Footpath", "count": 1 },
    { "category": "Public Transport", "count": 1 },
    { "category": "Road Damage", "count": 1 },
    { "category": "Accessibility", "count": 0 },
    { "category": "Other", "count": 0 }
  ],
  "bySeverity": [
    { "severity": "High", "count": 2 },
    { "severity": "Medium", "count": 1 },
    { "severity": "Low", "count": 1 }
  ],
  "hotspots": [
    {
      "label": "Sector 14 Market, Gurugram",
      "latitude": 28.472,
      "longitude": 77.043,
      "count": 3,
      "topCategory": "Streetlight"
    },
    {
      "label": "HUDA City Centre Metro, Gurugram",
      "latitude": 28.459,
      "longitude": 77.073,
      "count": 3,
      "topCategory": "Public Transport"
    }
  ],
  "ranked": [
    {
      "id": 1,
      "title": "Broken streetlight near main market gate",
      "category": "Streetlight",
      "severity": "High",
      "status": "Pending",
      "location": "Sector 14 Market, Gurugram",
      "supportCount": 14,
      "daysPending": 2,
      "priorityScore": 60,
      "isSample": true
    }
  ]
}
```

---

## 5. Allowed Status Transitions

The server enforces real-world civic progression rules:
- `Pending` $\rightarrow$ `In Progress` or `Resolved`
- `In Progress` $\rightarrow$ `Resolved`
- `Resolved` $\rightarrow$ `In Progress` (reopen)
- Disallowed transitions return `400 Bad Request`.
- Selecting the identical status returns `409 Conflict`.
