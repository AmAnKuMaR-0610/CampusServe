# Cloud Project Assessment Report — CampusServe (BMSCE)

**Project:** CampusServe — Cloud-Based College Student Service Request Platform  
**Environment:** Local Floci GCP Emulator (`v0.13.0` at `http://localhost:4588`, Project `floci-local`)  
**Assessment Date:** November 27, 2026  

---

## 1. Executive Summary

CampusServe is a full-stack student service request platform built for BMSCE to manage campus maintenance, IT support, facility tickets, department routing, community posts, campus decisions, and guided self-service via CampusBot. The application runs on a Node.js + Express ESM backend and React + Vite + Tailwind frontend backed by official Google Cloud SDKs configured against the local **Floci GCP Emulator (`v0.13.0`)**:

- **Backend API (`src/backend`)**: Node.js + Express ESM service on port `4000`, packaged with a Cloud Run-compatible `Dockerfile` (`campusserve-backend:local`), keyword-based auto-routing across 9 BMSCE support sectors (`campusData.js`), synthetic role-based demo sessions, and full REST endpoints.
- **Cloud Persistence & Telemetry**: Official `@google-cloud/firestore` and `@google-cloud/logging` SDKs plus Cloud Run v2 service registration, all verified in `verified-emulator` mode against `localhost:4588`, with automatic disk-backed fallback (`src/backend/local-data/`) if an emulator operation ever fails.
- **Glassmorphism UI & Theme System (`src/frontend`)**: React + Vite + Tailwind portal on port `5173` featuring the 5-theme picker (`Midnight`, `Aurora`, `Violet`, `Ember`, `Daylight`), 1-click synthetic login (`STU-1042`, `FAC-201`, `ADM-001`), role-aware Student and Admin dashboards, Submit/Track/Status Console, Sector Routing Kanban board, 24-location Campus Directory, Announcements, Posts, Anonymous Decisions, CampusBot, Admin Analytics & Audit, and Cloud & Privacy Verification.
- **Verification**: All 8 handbook test cases (**T01–T08**) executed automatically via `npm test` and passed (`8/8 PASS`), with evidence archived under `evidence/`.

---

## 2. Architecture & Request Lifecycle

CampusServe follows a three-tier architecture separating presentation, validation/lifecycle enforcement, and cloud adapter persistence:

1. **Client Layer (`http://localhost:5173`)**: Vite proxies `/api/*` requests to the Express API on port `4000`. Users authenticate via Synthetic Lab Mode (`STU-XXXX`, `FAC-XXX`, `ADM-XXX`) or 1-click demo login, switch between 5 glassmorphism themes, and interact with role-tailored views.
2. **API & Guardrail Layer (`http://localhost:4000`)**:
   - `validation.js` strictly validates request creation payloads (`category` enum `["Classroom Maintenance", "IT Support", "Facilities"]`, `location` 3–80 chars, `description` 10–500 chars, `requesterRef` `/^STU-\d{3,6}$/`).
   - `campusData.js` automatically computes `assignedDepartment` across 9 BMSCE sectors (`IT Services`, `Data Center`, `Infrastructure & Facilities`, `Electrical & HVAC`, `Lab Equipment`, `Library & Exam Cell`, `Security & Safety`, `Cleanliness & Waste`, `Hostel & Welfare`).
   - Generates non-guessable identifiers using `crypto.randomBytes(8).toString('hex')` prefixed with `REQ-` (64-bit random suffix).
   - Enforces a strict finite-state machine on `PATCH /api/requests/:id/status`:
     - `Submitted` → `["Assigned"]`
     - `Assigned` → `["In progress"]`
     - `In progress` → `["Resolved", "Closed"]`
     - `Resolved` → `["Closed"]`
     - `Closed` → `[]`
   - Illegal jumps (e.g., `Submitted` → `Resolved`) return HTTP `400` with `currentStatus` and `allowedNextStates` without mutating stored data.
3. **Cloud Adapter Layer (`src/backend/adapters/`)**:
   - `FirestoreAdapter` & `FirestoreCollectionStore`: Persist `serviceRequests`, `announcements`, `posts`, and `syntheticProfiles` in Floci Firestore (`FIRESTORE_EMULATOR_HOST=localhost:4588`).
   - `LoggingAdapter`: Emits structured logs to `projects/floci-local/logs/campusserve-api-audit` via `@google-cloud/logging` gRPC insecure channel.
   - `CloudRunAdapter`: Verifies and registers `campusserve-api` via Floci's Cloud Run v2 API.

---

## 3. Data Model & Privacy Design

### Request Document Schema (`serviceRequests`)
Each stored document contains:
- `requestId`: `REQ-<16 hex chars>` (e.g., `REQ-a6b6213610b5e717`)
- `category`: `"Classroom Maintenance" | "IT Support" | "Facilities"`
- `location`: Trimmed campus room/building string (3–80 chars)
- `description`: Trimmed issue summary (10–500 chars)
- `requesterRef`: Synthetic reference matching `/^STU-\d{3,6}$/`
- `assignedDepartment`: Auto-routed BMSCE support sector
- `status`: Initialized strictly to `"Submitted"`
- `createdAt`, `updatedAt`: ISO-8601 UTC timestamps
- `statusHistory`: Append-only array of `{ fromStatus, toStatus, changedBy, timestamp }`

### Privacy-by-Design & Zero-PII Logging
- **Synthetic Lab Mode Only**: Real student names, emails, USNs, and phone numbers are prohibited across seeds, auth forms, UI placeholders, and tests. `POST /api/auth/register` rejects payloads containing real `email` fields with HTTP `400`, and `POST /api/requests` rejects non-synthetic `requesterRef` values with HTTP `400`.
- **Log Redaction Whitelist**: `buildSafeLogEntry()` constructs every Cloud Logging payload from an explicit 6-key whitelist:
  `{ timestamp, requestId, operation, result, statusCode, latencyMs }`.
- Descriptions, `requesterRef`, locations, login payloads, post bodies, chat messages, headers, and credentials are never written to Cloud Logging.

---

## 4. Baseline Findings & Remediation

During Phase 1 probing of Floci `v0.13.0` (`http://localhost:4588`), three SDK behaviors were identified and resolved:

1. **Firestore REST vs. gRPC Emulator Transport**:
   - *Finding*: Direct HTTP REST calls to `/v1/projects/floci-local/databases/(default)/documents/...` returned `404`, and `preferRest: true` threw `NO_ADC_FOUND` without real GCP credentials.
   - *Remediation*: Configured `@google-cloud/firestore` with `FIRESTORE_EMULATOR_HOST=localhost:4588` using its default gRPC emulator transport, where `set`, `get`, `orderBy`, `update`, and `delete` all succeeded (`verified-emulator`).
2. **Cloud Logging Authentication Lookup**:
   - *Finding*: Instantiating `@google-cloud/logging` with default options failed with `NO_ADC_FOUND` because `google-auth-library` searched for Application Default Credentials.
   - *Remediation*: Configured `Logging` with `servicePath: 'localhost'`, `port: 4588`, and `sslCreds: grpc.credentials.createInsecure()`, enabling native `log.write()` and `getEntries()` against Floci without real credentials.
3. **Log Ordering & Collection Resilience**:
   - *Finding*: Unordered `getEntries` pagination can return older entries first as log volume grows, and Firestore `orderBy` queries on newer collections require graceful fallback if an index/field is missing.
   - *Remediation*: Added `orderBy: 'timestamp desc'` with an unordered retry fallback and in-memory descending sort across both logging and collection stores.

---

## 5. Automated Test Results (T01–T08)

Executed via `npm test` (`tests/run-tests.mjs`) against the extended Express API and Floci `v0.13.0` (`evidence/test-matrix-results.md`):

| Test ID | Verification Scenario | Result | Observed Evidence |
| :--- | :--- | :--- | :--- |
| **T01** | Submit valid synthetic request → `201` + unique `REQ-...` ID | **PASS** | Created `REQ-a6b6213610b5e717` (`status=Submitted`, 66 ms) |
| **T02** | Look up existing ID → `200` with fields | **PASS** | Retrieved `REQ-a6b6213610b5e717` with matching fields (28 ms) |
| **T03** | Look up unknown ID (`REQ-0000000000000000`) → `404` | **PASS** | Controlled `404` with `{"error":"Service request not found"}` (27 ms) |
| **T04** | Submit invalid/PII-like fields → `400` rejection | **PASS** | Rejected invalid category, short location/description, and `"Rohan Sharma"` ref with 4 errors (15 ms) |
| **T05** | Invalid transition (`Submitted` → `Resolved`) → `400` & unchanged | **PASS** | Rejected with `allowedNextStates: ["Assigned"]`; re-read confirmed status remained `"Submitted"` (52 ms) |
| **T06** | Inspect `/api/logs` for zero PII/descriptions/secrets | **PASS** | Verified 29 entries in `evidence/redacted-logs-evidence.json` contained only the 6 whitelisted keys |
| **T07** | Stop & restart backend server, retrieve T01 ID | **PASS** | Restarted backend (`PID=16836`); `REQ-a6b6213610b5e717` retrieved intact from Floci Firestore (1136 ms) |
| **T08** | Verify `/api/health` matches Floci capabilities | **PASS** | Matched Floci `v0.13.0`; Firestore, Cloud Logging, and Cloud Run all reported `verified-emulator` (42 ms) |

---

## 6. Service Limitations & Local Emulator Scope

1. **Cloud Run Execution Model**: Floci `v0.13.0` emulates Cloud Run v2 service resource endpoints (`GET`/`POST`/`DELETE`) and generates a simulated service URI, while the Express API executes locally on port `4000` with a verified `src/backend/Dockerfile` (`campusserve-backend:local`) ready for Cloud Run deployment.
2. **Local Emulator Persistence**: Floci stores state inside the running `floci-gcp` container; the backend's `labeled-local-adapter` fallback preserves state on host disk (`src/backend/local-data/`) whenever fallback mode is triggered.
3. **Synthetic Authentication Scope**: Login/registration uses synthetic role IDs (`STU-XXXX`, `FAC-XXX`, `ADM-XXX`) for Synthetic Lab Mode and intentionally avoids storing passwords, emails, or real PII.

---

## 7. Timed 7–10 Minute Demo Script

- **0:00 – 1:30 | Synthetic Login, Theme Picker & Telemetry Check**:
  - Open `http://localhost:5173`. Show the **Theme Picker** (`Midnight`, `Aurora`, `Violet`, `Ember`, `Daylight`) and the `Floci GCP Connected • localhost:4588` pill.
  - Click **Student STU-1042** under *1-Click Synthetic Demo Login* to enter the Student Home Dashboard.
  - Click **Seed Synthetic Demo Data** in the top bar if needed to populate synthetic requests, announcements, community posts, and campus decisions.
- **1:30 – 3:30 | Requests & Track — Validation, Auto-Routing & 404 Guardrail**:
  - Open **Requests & Track → Submit Request**. Submit an invalid payload (e.g., `"Rohan Sharma"` in Student Ref) to demonstrate HTTP `400` validation.
  - Submit a valid synthetic ticket using the BMSCE Location autocomplete; highlight the newly issued `REQ-...` ID, auto-routed `assignedDepartment` chip, **Copy ID**, and **Track Request →**.
  - Click **Test Unknown ID (404)** (`REQ-0000000000000000`) to display the controlled `404` view, then click a Recent Request ID chip to inspect the 4-step progress stepper and `statusHistory` timeline.
- **3:30 – 5:30 | Community, Directory & CampusBot**:
  - Open **Campus Directory** (filter 24 BMSCE rooms/labs and click *Report issue →*), **Campus Posts** (upvote/react), **Campus Decisions** (cast an anonymous synthetic ballot and show the SHA-256 receipt), and **CampusBot** (lookup a live `REQ-...` ticket ID).
- **5:30 – 7:30 | Admin Role, Sector Routing, State Machine & Analytics**:
  - Click the top-right user chip → **Switch Role / Sign Out** → click **Admin ADM-001**.
  - Inspect **Admin Dashboard** and **Sector Routing** (9-sector Kanban board).
  - Open **Requests & Console → Status Console**, click **Test Invalid Jump** (`Submitted → Resolved`) to show live HTTP `400` rejection, then advance the ticket legally (`Assign → Start Progress → Resolve → Close`).
  - Open **Analytics** and **Audit Log** to show live aggregated metrics and redacted transitions.
- **7:30 – 9:30 | Cloud & Privacy Verification + `npm test`**:
  - Open **Logs & Cloud Verify** to show all three `verified-emulator` cards (`Cloud Run`, `Cloud Firestore`, `Cloud Logging`) and toggle **Table / Raw JSON** in the Privacy-Safe Structured Log Viewer proving zero PII, descriptions, or login payloads appear in Cloud Logging.
