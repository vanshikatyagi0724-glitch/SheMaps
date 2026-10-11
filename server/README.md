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

# 3. Seed initial sample data into the database (4 Gurugram issues with coordinates)
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

## 3. API Endpoints Reference

**Base URL:** `http://localhost:5000/api`

| Method | Endpoint | Description | Request Body | Success Code | Error Codes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/health` | Server health check and uptime probe | None | `200` | - |
| `GET` | `/issues` | List issues (newest first). Optional query filters: `status`, `category`, `severity`, `supporterId` | None | `200` | `400` (invalid filter) |
| `POST` | `/issues` | Create a new civic hazard report | `{ title, description?, category, location, severity, latitude?, longitude? }` | `201` | `400` (validation error) |
| `PATCH` | `/issues/:id/status` | Update issue resolution status (allowed transitions only) | `{ status, note? }` (Requires header `x-admin-key` if `ADMIN_KEY` is configured) | `200` | `400` (invalid transition), `403` (forbidden), `404` (not found), `409` (same status) |
| `POST` | `/issues/:id/support` | Upvote an issue ("I face this too") | `{ supporterId }` (8 to 64 character string) | `201` | `400` (invalid id/body), `404` (not found), `409` (duplicate support) |

### Status Transition Rules
- `Pending` ➡️ `In Progress` or `Resolved`
- `In Progress` ➡️ `Resolved`
- `Resolved` ➡️ `In Progress` (reopening an issue)
- Attempting to set the current status ➡️ `409 Conflict`
- Any disallowed jump (e.g. `In Progress` ➡️ `Pending`) ➡️ `400 Bad Request`

---

## 4. Testing Endpoints (PowerShell & curl Examples)

### 1. Health Check
```powershell
Invoke-RestMethod -Uri "http://localhost:5000/api/health" -Method Get
```
*Expected Response:*
```json
{ "status": "ok" }
```

### 2. Fetch Issues List (with Supporter Identification)
```powershell
Invoke-RestMethod -Uri "http://localhost:5000/api/issues?supporterId=user_random_12345" -Method Get
```
*Expected Response:* Array of issues where each item contains `"supported": true/false` for that `supporterId`.

### 3. Create a New Issue (Valid)
```powershell
$body = @{
  title = "Broken streetlight outside bus stop"
  description = "Dark area near Sector 14 market"
  category = "Streetlight"
  location = "Sector 14, Gurugram"
  severity = "High"
  latitude = 28.4720
  longitude = 77.0425
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:5000/api/issues" -Method Post -Body $body -ContentType "application/json"
```
*Status Code:* `201 Created`

### 4. Create an Issue with Invalid Data (Verifying 400 Bad Request)
```powershell
$invalidBody = @{ title = "No"; location = "" } | ConvertTo-Json
Invoke-RestMethod -Uri "http://localhost:5000/api/issues" -Method Post -Body $invalidBody -ContentType "application/json"
```
*Status Code:* `400 Bad Request` with field-level validation errors.

### 5. Community Upvote / Support ("I face this too")
```powershell
$supportBody = @{ supporterId = "supporter_client_9999" } | ConvertTo-Json
Invoke-RestMethod -Uri "http://localhost:5000/api/issues/1/support" -Method Post -Body $supportBody -ContentType "application/json"
```
- **First Call:** Returns `201 Created` and increments `supportCount`.
- **Second Call (with the same `supporterId`):** Returns `409 Conflict` with error message `"Issue has already been supported by this supporter"`.

### 6. Update Resolution Status
```powershell
$statusBody = @{ status = "In Progress"; note = "Assigned to PWD maintenance team" } | ConvertTo-Json
Invoke-RestMethod -Uri "http://localhost:5000/api/issues/1/status" -Method Patch -Body $statusBody -ContentType "application/json"
```
*Status Code:* `200 OK` (creates an audit record in `issue_status_history`).

---

## 5. Automated Verification Test Suite

You can execute the entire automated test suite with a single command:
```bash
node test-api.js
```

This script automatically verifies:
- Health check probe
- Issue listing with query filters and supporter state
- Invalid query filter handling (`400`)
- Valid issue creation (`201`)
- Field-level validation error reporting (`400`)
- Coordinate rules (both-or-neither rule enforcement)
- Community upvoting (`201`) and duplicate prevention (`409`)
- Valid status transitions (`200`), duplicate status attempts (`409`), and illegal jumps (`400`)
- Missing issue handling (`404`)
- Malformed JSON payload handling (`400`)
