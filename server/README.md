# SheMaps Backend & Database Setup (Hinglish Guide) 🚀

SheMaps project ka yeh standalone backend service hai. Yeh Node.js (ES modules), Express, aur `better-sqlite3` file database use karta hai. Frontend ke saare fields aur status transitions ke saath fully compatible hai.

---

## 1. Quick Setup & Run Kaise Karein

### Prerequisites:
- Node.js v18+ ya v20+ / v22+
- npm

### Step-by-Step Installation:
```bash
# 1. Server folder me enter karein
cd server

# 2. Dependencies install karein (express, better-sqlite3, cors, dotenv)
npm install

# 3. Sample data database me seed karein (4 Gurugram issues with coordinates)
npm run seed

# 4. Development mode me server start karein (auto-reload on save)
npm run dev
```

Server default port `http://localhost:5000` par chalega.
Agar database file nahi bani hai, toh `server/data/shemaps.db` automatically create ho jayegi.

---

## 2. Environment Variables (`server/.env`)

| Variable Name | Default Value | Description |
| :--- | :--- | :--- |
| `PORT` | `5000` | Port jaha Express backend listen karega |
| `DB_PATH` | `./data/shemaps.db` | SQLite database file ka path |
| `CORS_ORIGIN` | `http://localhost:5173` | Allowed frontend URL (Vite default) |
| `ADMIN_KEY` | *(empty)* | Optional: agar set hai, toh status update ke liye header `x-admin-key` zaroori hoga |

---

## 3. API Endpoints Table

Base URL: `http://localhost:5000/api`

| Method | Endpoint | Description | Request Body | Success Code | Error Codes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/health` | Server health check | None | `200` | - |
| `GET` | `/issues` | List issues (newest first). Query params: `status`, `category`, `severity`, `supporterId` | None | `200` | `400` (invalid filter) |
| `POST` | `/issues` | Naya issue report create karna | `{ title, description?, category, location, severity, latitude?, longitude? }` | `201` | `400` (validation) |
| `PATCH` | `/issues/:id/status` | Issue status update karna (allowed transitions only) | `{ status, note? }` (Header: `x-admin-key` if `ADMIN_KEY` set) | `200` | `400` (invalid transition), `403` (unauthorized), `404` (not found), `409` (same status) |
| `POST` | `/issues/:id/support` | Issue upvote karna ("I face this too") | `{ supporterId }` (8 to 64 chars string) | `201` | `400` (invalid id/body), `404` (not found), `409` (duplicate support) |

### Status Transitions Rules:
- `Pending` ➡️ `In Progress` ya `Resolved`
- `In Progress` ➡️ `Resolved`
- `Resolved` ➡️ `In Progress` (reopen)
- Same status set karne par ➡️ `409 Conflict`
- Koi aur jump (e.g. `In Progress` ➡️ `Pending`) ➡️ `400 Bad Request`

---

## 4. Testing Endpoints (PowerShell & curl Commands)

### 1. Health Check
```powershell
Invoke-RestMethod -Uri "http://localhost:5000/api/health" -Method Get
```
*Response: `{ "status": "ok" }`*

### 2. Issues List Fetch Karna (with supporterId)
```powershell
Invoke-RestMethod -Uri "http://localhost:5000/api/issues?supporterId=user_random_12345" -Method Get
```
*Response: Array of issues. Har item me `supported: true/false` hoga.*

### 3. Naya Issue Create Karna (Valid)
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
*Status: `201 Created`*

### 4. Invalid Create (Check 400 Bad Request)
```powershell
$invalidBody = @{ title = "No"; location = "" } | ConvertTo-Json
Invoke-RestMethod -Uri "http://localhost:5000/api/issues" -Method Post -Body $invalidBody -ContentType "application/json"
```
*Status: `400 Bad Request` with field-wise errors.*

### 5. Community Upvote / Support ("I face this too")
```powershell
$supportBody = @{ supporterId = "supporter_client_9999" } | ConvertTo-Json
Invoke-RestMethod -Uri "http://localhost:5000/api/issues/1/support" -Method Post -Body $supportBody -ContentType "application/json"
```
*Pehli baar call karne par: `201 Created`*
*Same supporterId se dubara call karne par: `409 Conflict` (Duplicate prevent ho gaya)*

### 6. Status Change
```powershell
$statusBody = @{ status = "In Progress"; note = "Assigned to PWD team" } | ConvertTo-Json
Invoke-RestMethod -Uri "http://localhost:5000/api/issues/1/status" -Method Patch -Body $statusBody -ContentType "application/json"
```
*Status: `200 OK` (History me record create hoga).*

---

## 5. Automated Verification Test Suite
Ek hi command se saare test run karne ke liye:
```bash
node test-api.js
```
Yeh script automated tareeqe se valid/invalid create, duplicate support, status transitions, bad JSON, 404s, etc. check karke summary deta hai.
