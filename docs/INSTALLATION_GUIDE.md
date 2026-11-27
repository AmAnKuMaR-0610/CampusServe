# CampusServe — Complete Windows Installation & Setup Guide

Welcome to **CampusServe**, a cloud-based college student service request platform built for BMSCE. This guide walks you step by step through setting up and running the entire application on **Windows 10 or Windows 11** from scratch—using a local **Floci GCP Emulator** so you do **not** need a real Google Cloud account, billing card, or service account key.

---

## 1. System Overview & Architecture Summary

CampusServe runs as three lightweight layers working together on your computer:

1. **Floci GCP Emulator (`http://localhost:4588` in Docker)**  
   A local Docker container (`floci-gcp`) that simulates Google Cloud services right on your machine.
2. **Backend Express API (`http://localhost:4000`)**  
   A Node.js + Express ESM server (`src/backend/server.js`) that validates service requests, generates non-guessable `REQ-` tracking IDs, enforces status transition rules (`Submitted → Assigned → In progress → Resolved → Closed`), auto-routes tickets across 9 BMSCE departments, and talks to Floci using official Google Cloud SDKs (`@google-cloud/firestore` and `@google-cloud/logging`).
3. **Frontend React Web App (`http://localhost:5173`)**  
   A React + Vite + Tailwind CSS portal (`src/frontend/`) that you open in your browser. Vite automatically forwards all `/api/*` requests to the backend on port `4000` (configured in `src/frontend/vite.config.js`).

### How Floci GCP Is Integrated
CampusServe connects to Floci (`http://localhost:4588`) for three core cloud services:
- **Cloud Firestore (`verified-emulator`):** Stores all service requests (`serviceRequests`), announcements, community posts/decisions, and synthetic lab profiles using `@google-cloud/firestore` over gRPC (`FIRESTORE_EMULATOR_HOST=localhost:4588`).
- **Cloud Logging (`verified-emulator`):** Stores privacy-safe structured audit logs using `@google-cloud/logging` (`campusserve-api-audit`), strictly limited to `{ timestamp, requestId, operation, result, statusCode, latencyMs }`—zero student descriptions or personal data ever reach the logs.
- **Cloud Run (`verified-emulator` control plane):** Verifies and registers the `campusserve-api` service metadata via Floci's Cloud Run v2 API while the Node.js server runs locally on port `4000` (with a production-ready `src/backend/Dockerfile` included).
- **Resilient Local Fallback (`labeled-local-adapter`):** If any Floci operation is ever unreachable or throws an unimplemented error, the backend adapters in `src/backend/adapters/` automatically route reads and writes to disk under `src/backend/local-data/` so no data is lost across restarts, and report the exact status on `/api/health`.

---

## 2. Prerequisites & Software Downloads

Install these five tools before setting up the project. Open **PowerShell** (Run as Administrator for WSL 2) to verify each step.

### 1) WSL 2 (Windows Subsystem for Linux)
Docker Desktop on Windows uses WSL 2 as its fast Linux engine.
- **Documentation:** https://learn.microsoft.com/en-us/windows/wsl/install
- **Install command (PowerShell as Administrator):**
  ```powershell
  wsl --install
  ```
  *(Restart your PC if prompted after installing WSL 2.)*
- **Verify:**
  ```powershell
  wsl --version
  ```

### 2) Docker Desktop (with WSL 2 Backend Enabled)
- **Download:** https://www.docker.com/products/docker-desktop/
- During installation, keep **"Use WSL 2 instead of Hyper-V"** checked.
- After launching Docker Desktop, open **Settings → General** and confirm **"Use the WSL 2 based engine"** is checked, and wait until the bottom-left engine indicator says **Engine running**.
- **Verify:**
  ```powershell
  docker --version
  docker ps
  ```

### 3) Node.js LTS & npm
- **Download (LTS v20+ or v22/v24):** https://nodejs.org/en/download
- Run the Windows `.msi` installer with default options (includes `npm` and adds Node to `PATH`).
- **Verify (open a fresh PowerShell window):**
  ```powershell
  node --version
  npm --version
  ```

### 4) Git
- **Download:** https://git-scm.com/download/win
- Install with default options.
- **Verify:**
  ```powershell
  git --version
  ```

### 5) Floci CLI
Floci provides the local GCP emulator container (`floci-gcp`) and CLI management commands.
- **Website / Docs:** https://floci.io
- **Install command (PowerShell):**
  ```powershell
  irm https://floci.io/install.ps1 | iex
  ```
- **Verify & run health check:**
  ```powershell
  floci --version
  floci gcp doctor
  ```

---

## 3. Step-by-Step Project Installation

### Step 1: Clone or Open the Repository
If cloning from Git:
```powershell
git clone <your-repository-url> CampusServe
cd CampusServe
```
Or, if you already have the folder locally (e.g., `C:\Users\<YourName>\CampusServe`), open PowerShell inside that folder:
```powershell
cd "C:\Users\Aman Kumar\CampusServe"
```

### Step 2: Install Dependencies
The root `package.json` orchestrates scripts across the workspace (it has no external packages of its own), while `src/backend/package.json` and `src/frontend/package.json` hold the API and UI dependencies.

Run these commands from the **CampusServe root folder**:
```powershell
npm install
npm --prefix src/backend install
npm --prefix src/frontend install
```

### Step 3: Environment Variables (No Real GCP Keys Needed)
CampusServe is preconfigured for local Floci emulation and defaults to:
- `GOOGLE_CLOUD_PROJECT=floci-local`
- `FIRESTORE_EMULATOR_HOST=localhost:4588`
- `FLOCI_ENDPOINT=http://localhost:4588`
- `PORT=4000`

Because `@google-cloud/firestore` and `@google-cloud/logging` connect directly to `localhost:4588` using emulator/insecure gRPC channels, **you do not need any GCP project account, `gcloud auth`, or JSON service account key file**.

To set the environment variables explicitly in your current PowerShell session:
```powershell
$env:GOOGLE_CLOUD_PROJECT = "floci-local"
$env:FIRESTORE_EMULATOR_HOST = "localhost:4588"
```

---

## 4. How to Start Everything (Daily Startup Order)

Follow this order whenever you start working on CampusServe. You will keep **two PowerShell terminals** open for the backend and frontend (plus Floci running in Docker).

### Step 1: Start Docker Desktop & Floci GCP Emulator
1. Open **Docker Desktop** and wait until it shows **Engine running**.
2. Start Floci GCP with local data persistence so your emulator data survives restarts:
   ```powershell
   floci gcp start --persist ./floci-data
   ```
   *(If `floci-gcp` is already running, do not overwrite it—just check its status below.)*
3. Verify Floci is healthy and all services are active:
   ```powershell
   floci gcp status
   floci gcp services
   ```
   You can also check directly with PowerShell:
   ```powershell
   Invoke-WebRequest -Uri "http://localhost:4588/health" -UseBasicParsing
   ```

### Step 2: Start the Backend API Server (Port `4000`)
In **Terminal 1** (from the `CampusServe` root folder):
```powershell
$env:GOOGLE_CLOUD_PROJECT = "floci-local"
$env:FIRESTORE_EMULATOR_HOST = "localhost:4588"
npm run dev:backend
```
Wait until you see:
```text
[CampusServe API] Listening on http://localhost:4000
[CampusServe API] Floci Endpoint: http://localhost:4588 (Project: floci-local)
[CampusServe API] Firestore: verified-emulator | Logging: verified-emulator | Cloud Run: verified-emulator
```
*(Tip: For auto-reload while editing backend files, you can run `npm --prefix src/backend run dev` instead.)*

### Step 3: Start the Frontend Dev Server (Port `5173`)
Open **Terminal 2** (from the `CampusServe` root folder):
```powershell
npm run dev:frontend
```
Wait until Vite prints:
```text
VITE v6.x.x  ready in ... ms
➜  Local:   http://localhost:5173/
```

### Step 4: Open CampusServe in Chrome & Seed Synthetic Demo Data
1. Open Google Chrome and go to **`http://localhost:5173`**.
2. On the login screen, click any **1-Click Synthetic Demo Login** button (such as **Student STU-1042**, **Faculty FAC-201**, or **Admin ADM-001**).
3. In the top bar, confirm the status pill reads **`Floci GCP Connected • localhost:4588`**.
4. Click **`Seed Synthetic Demo Data`** in the top bar (calls `POST /api/seed`) to populate 4 synthetic BMSCE service requests, 3 official announcements, 3 community posts, and 3 campus decisions.

### Optional: Build & Verify the Cloud Run Backend Docker Image
To test packaging the Express API for Google Cloud Run (`src/backend/Dockerfile`):
```powershell
docker build -t campusserve-backend:local src/backend
```
*(You can also verify the frontend production bundle anytime with `npm run build:frontend`.)*

---

## 5. Running the Automated Verification Tests (T01–T08)

> **Important:** Stop the backend server in **Terminal 1** (`Ctrl + C`) before running `npm test`. The test runner automatically starts, stops, and restarts the backend on port `4000` to verify persistence across server restarts (Test `T07`). Make sure **Floci GCP (`localhost:4588`) is running**.

From the `CampusServe` root folder, run:
```powershell
npm test
```
This runs `node tests/run-tests.mjs` and executes all 8 handbook verification tests:

| Test ID | What It Verifies |
| :--- | :--- |
| **T01** | Submits a valid synthetic request (`POST /api/requests`) and confirms HTTP `201`, a non-guessable `REQ-<16 hex>` ID, and initial status `Submitted`. |
| **T02** | Looks up the T01 request ID (`GET /api/requests/:id`) and confirms HTTP `200` with all saved fields intact. |
| **T03** | Looks up an unknown ID (`REQ-0000000000000000`) and confirms a controlled HTTP `404` JSON response. |
| **T04** | Submits invalid inputs (unsupported category, short location/description, real-looking name instead of `STU-XXXX`) and confirms HTTP `400` rejection. |
| **T05** | Attempts an illegal state jump (`Submitted → Resolved` via `PATCH /api/requests/:id/status`), confirms HTTP `400` rejection, and verifies the record remains `Submitted`. |
| **T06** | Inspects `GET /api/logs` and asserts **zero occurrences** of descriptions, `requesterRef`, locations, or secrets (only the 6 metadata keys exist). |
| **T07** | Programmatically stops and restarts the backend Node.js process, then retrieves the T01 request ID to confirm persistence survives server restarts. |
| **T08** | Compares `GET /api/health` against live Floci `http://localhost:4588/health` to verify reported service modes (`verified-emulator` / `labeled-local-adapter`). |

### Where Test Evidence Is Saved
Every successful `npm test` run automatically updates:
- **`evidence/test-matrix-results.md`** — Formatted markdown table of T01–T08 pass/fail status, durations, and observed results.
- **`evidence/redacted-logs-evidence.json`** — Snapshot of the privacy-safe structured logs captured during the run.

After `npm test` finishes, restart Terminal 1 (`npm run dev:backend`) if you want to keep using the web UI.

---

## 6. Common Errors & Troubleshooting Table

| Symptom / Error | Cause | How to Fix It |
| :--- | :--- | :--- |
| **`EADDRINUSE: address already in use :::4000`** (or `4588`, `5173`) | Another terminal or background process is already using that port. For `npm test`, Terminal 1's backend is still running. | Stop the old terminal with `Ctrl + C`. To find and stop a stray process on port `4000` (or `5173`), run:<br>`Get-NetTCPConnection -LocalPort 4000 \| Select-Object OwningProcess`<br>`Stop-Process -Id <PID> -Force` |
| **Docker daemon / pipe error** (`error during connect ... dockerDesktopLinuxEngine`) | Docker Desktop is closed or still booting up. | Launch **Docker Desktop** from the Start Menu, wait until it shows **Engine running**, then run `floci gcp start --persist ./floci-data`. |
| **Seeing `Cannot GET /` on `http://localhost:4000`** or **`Resource not found` on `http://localhost:4588`** | Completely normal! Port `4000` is the JSON REST API server and port `4588` is the Floci GCP emulator—neither serves a webpage at `/`. | Open **`http://localhost:5173`** in your browser for the CampusServe UI. Use `/api/health` on port `4000` and `/health` on port `4588` to check health. |
| **PowerShell says `running scripts is disabled on this system`** (`PSSecurityException`) | Windows default ExecutionPolicy blocks unsigned `.ps1` scripts (including `npm.ps1` or `floci` installer). | Run this once for your user account in PowerShell:<br>`Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser` |
| **Top bar shows `Backend Disconnected` or Vite proxy `ECONNREFUSED 127.0.0.1:4000`** | The frontend is running on `5173`, but the backend on `4000` is not started yet. | Start Terminal 1 with `npm run dev:backend` and refresh the browser tab. |
| **`/api/health` shows `labeled-local-adapter` instead of `verified-emulator`** | Floci (`localhost:4588`) is stopped or unreachable, so CampusServe automatically switched to disk persistence in `src/backend/local-data/`. | Start Floci (`floci gcp start --persist ./floci-data`) and refresh `/api/health`; it will switch back to `verified-emulator`. |
| **`NO_ADC_FOUND` or credential errors when modifying SDK code** | Google Cloud SDKs attempt to find Application Default Credentials if emulator host / insecure gRPC options are removed. | Keep `FIRESTORE_EMULATOR_HOST=localhost:4588` and `GOOGLE_CLOUD_PROJECT=floci-local` set, and keep the insecure gRPC client configuration in `src/backend/adapters/loggingAdapter.js`. |
