# SheMaps Backend & Database Documentation 🚀

This is the standalone backend service for the **SheMaps** project. It is built with Node.js (ES modules), Express, and `better-sqlite3` as an embedded SQLite file database. It is designed to match all frontend fields, categories, severities, and status transitions out-of-the-box.

---

## 1. Quick Setup & How to Run

### Prerequisites
- Node.js v18+, v20+, or v22+
- npm

### Step-by-Step Installation
```bash
# 1. Navigate to the server folder
cd server

# 2. Install dependencies (express, better-sqlite3, cors, dotenv)
npm install

# 3. Seed initial sample data into the database (12 Gurugram issues with realistic clusters and coordinates)
npm run seed

# 4. Start the server in development watch mode (auto-reloads on file save)
npm run dev
```

The server will start by default at `http://localhost:5000`.
If the database directory or file does not exist yet, `server/data/shemaps.db` will be created automatically.

---

## 2. Environment Variables (`server/.env`)

Configure your local environment by creating `server/.env` (a template is provided in `server/.env.example`):

| Variable Name | Default Value | Description |
| :--- | :--- | :--- |
| `PORT` | `5000` | Port where the Express server listens |
| `DB_PATH` | `./data/shemaps.db` | File path for the SQLite database |
| `CORS_ORIGIN` | `http://localhost:5173` | Allowed frontend origin (Vite default dev URL) |
| `ADMIN_KEY` | *(empty)* | Optional: when set, requires the `x-admin-key` header for status transitions |

---

## 3. Priority Score Formula

The priority score is computed dynamically by the API for every issue:

$$\text{priorityScore} = (\text{severityWeight} \times 10) + (\text{supportCount} \times 2) + \text{daysPending}$$

- **severityWeight:**
  - `High` = 3 (contributes 30 points)
  - `Medium` = 2 (contributes 20 points)
  - `Low` = 1 (contributes 10 points)
- **supportCount:** Number of community members who supported the issue (contributes 2 points each).
- **daysPending:** Whole days elapsed since `created_at` (minimum 0).
- **isSample:** `1` (`true`) for seeded sample issues, `0` (`false`) for community submissions.

---

## 4. API Endpoints Reference

**Base URL:** `http://localhost:5000/api`

| Method | Endpoint | Description | Request Body | Success Code | Error Codes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/health` | Server health check and uptime probe | None | `200` | - |
| `GET` | `/issues` | List issues (newest first). Optional query filters: `status`, `category`, `severity`, `sort=priority`, `supporterId` | None | `200` | `400` (invalid filter) |
| `POST` | `/issues` | Create a new civic hazard report | `{ title, description?, category, location, severity, latitude?, longitude?, supporterId? }` | `201` | `400` (validation error) |
| `PATCH` | `/issues/:id/status` | Update issue resolution status (allowed transitions only) | `{ status, note? }` (Requires header `x-admin-key` if `ADMIN_KEY` is configured) | `200` | `400` (invalid transition), `403` (forbidden), `404` (not found), `409` (same status) |
| `POST` | `/issues/:id/support` | Upvote an issue ("I face this too") | `{ supporterId }` (8 to 64 character string) | `201` | `400` (invalid id/body), `404` (not found), `409` (duplicate support) |
| `GET` | `/dashboard` | City Prioritization Dashboard statistics, category breakdowns, hotspots, and top 10 ranked unresolved issues | None | `200` | - |

---

## 5. `GET /api/dashboard` Response Example

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

### Hotspot Cluster Calculation
Hotspots are calculated by grouping unresolved issues (`status != 'Resolved'`) whose coordinates round to 3 decimal places (~110m accuracy) and sorting by issue count descending (top 5 clusters). Issues with `null` coordinates are excluded.

---

## 6. Status Transition Rules
- `Pending` ➡️ `In Progress` or `Resolved`
- `In Progress` ➡️ `Resolved`
- `Resolved` ➡️ `In Progress` (reopening an issue)
- Attempting to set the current status ➡️ `409 Conflict`
- Disallowed jumps (e.g. `In Progress` ➡️ `Pending`) ➡️ `400 Bad Request`

---

## 7. Automated Verification Test Suite

You can execute the entire automated test suite with a single command:
```bash
node test-api.js
```

This script verifies:
1. Health check probe (`200`)
2. Issue listing with query filters and supporter state (`200`)
3. Invalid query filter handling (`400`)
4. Valid issue creation (`201`)
5. Field-level validation error reporting (`400`)
6. Coordinate rules (both-or-neither rule enforcement)
7. Community upvoting (`201`) and duplicate prevention (`409`)
8. Valid status transitions (`200`), duplicate status attempts (`409`), and illegal jumps (`400`)
9. Nonexistent issue handling (`404`)
10. Malformed JSON payload handling (`400`)
11. Dynamic `priorityScore` formula calculation
12. `GET /api/dashboard` schema and metrics totals
13. Ranked list filtering (unresolved only) and sorting (`priorityScore DESC`)
14. Hotspots coordinate grouping and null coordinate exclusion
