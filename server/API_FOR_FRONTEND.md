# SheMaps — Frontend Integration Guide

Hey teammate! Here is everything you need to replace `localStorage` with the backend API.

The base URL is: `http://localhost:5000/api`

---

## 1. Helper Snippet: Persistent `supporterId` & API Fetcher

Add this small helper file or utility function in your frontend codebase:

```javascript
// src/api.js (or directly in App.jsx)

export const API_BASE = "http://localhost:5000/api";

// Generates a random anonymous ID (once) and keeps it in localStorage
export function getSupporterId() {
  let id = localStorage.getItem("shemaps_supporter_id");
  if (!id) {
    id = "user_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
    localStorage.setItem("shemaps_supporter_id", id);
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

## 2. UI Actions $\rightarrow$ API Mapping

### A. Load Dashboard & Issues List (Page Mount & Filter Change)
**UI Action:** When the dashboard loads or when the user changes a filter button (`Pending`, `In Progress`, `Resolved`).

```javascript
useEffect(() => {
  async function loadIssues() {
    const supporterId = getSupporterId();
    // Pass query params for filtering and supporter identification
    const query = new URLSearchParams();
    if (filter !== "All") query.set("status", filter);
    query.set("supporterId", supporterId);

    const issues = await apiRequest(`/issues?${query.toString()}`);
    setIssues(issues);
  }

  loadIssues().catch(console.error);
}, [filter]);
```

**Returned Object Format:**
```json
[
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
    "createdAt": "2026-10-11 12:00:00",
    "updatedAt": "2026-10-11 12:00:00"
  }
]
```
> Notice that `supported` is a boolean: if `true`, you can disable the *"♡ I face this too"* button and show *"✓ Supported"*!

---

### B. Submit a New Issue (`+ Report an Issue`)
**UI Action:** Form submission in the report modal.

```javascript
async function handleSubmit(event) {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);

  const payload = {
    title: formData.get("title"),
    category: formData.get("category"),
    location: formData.get("location") || "Pinned location",
    severity: formData.get("severity"),
    latitude: selectedCoordinates?.lat ?? null,
    longitude: selectedCoordinates?.lng ?? null,
    supporterId: getSupporterId(), // Marks reporter as initial supporter
  };

  try {
    const newIssue = await apiRequest("/issues", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    // Prepend to current issues list
    setIssues((prev) => [newIssue, ...prev]);
    setShowForm(false);
  } catch (err) {
    alert(err.message + (err.details ? ": " + JSON.stringify(err.details) : ""));
  }
}
```

---

### C. Upvote an Issue (`"♡ I face this too"`)
**UI Action:** Clicking the support button on an issue card.

```javascript
async function handleSupport(issueId) {
  const supporterId = getSupporterId();

  try {
    const updatedIssue = await apiRequest(`/issues/${issueId}/support`, {
      method: "POST",
      body: JSON.stringify({ supporterId }),
    });

    // Update state with new support count and supported: true
    setIssues((prev) =>
      prev.map((item) => (item.id === issueId ? updatedIssue : item))
    );
  } catch (err) {
    if (err.status === 409) {
      alert("You have already supported this issue!");
    } else {
      console.error(err);
    }
  }
}
```

---

### D. Update Status Dropdown
**UI Action:** Selecting a new status from the dropdown (`Pending`, `In Progress`, `Resolved`).

```javascript
async function handleStatusChange(issueId, newStatus) {
  try {
    const updatedIssue = await apiRequest(`/issues/${issueId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status: newStatus }),
    });

    setIssues((prev) =>
      prev.map((item) => (item.id === issueId ? updatedIssue : item))
    );
  } catch (err) {
    alert(err.message);
  }
}
```

---

## 3. Allowed Status Transitions
Keep in mind that the server enforces real-world civic issue progression rules:
* `Pending` can transition to `In Progress` or `Resolved`
* `In Progress` can transition to `Resolved`
* `Resolved` can transition back to `In Progress` (reopen)
* Attempting to jump backwards to `Pending` will return `400 Bad Request`.
* Selecting the same status returns `409 Conflict`.
