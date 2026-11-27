# CampusServe — Features & Live Evaluation Demo Guide

This guide explains what **CampusServe** does, how **Floci GCP** powers it behind the scenes, every feature implemented in the integrated React + Express application, and a timed **7–10 minute demo script** plus **Viva Q&A** for the **BMSCE Cloud Computing Skill Lab Review – 2**.

---

## 1. What Is CampusServe & How Floci GCP Is Integrated

### The Problem CampusServe Solves
In many college campuses, classroom maintenance issues (broken projectors, flickering lights), IT problems (Wi-Fi drops, lab workstation errors), and facilities requests (water dispensers, power sockets) are reported through scattered emails, paper registers, or chat messages. Students have no tracking ID, staff lack clear department routing, and administrators have no clean audit trail.

**CampusServe** solves this by centralizing campus service requests into one structured, cloud-backed portal using **synthetic student references only** (`STU-XXXX`, `FAC-XXX`, `ADM-XXX`)—so no real student names, emails, or phone numbers are ever collected or exposed.

### How Floci GCP (`http://localhost:4588`) Powers the Backend
CampusServe connects directly to your local **Floci GCP Emulator (`v0.13.0`)** using official Google Cloud Node.js SDKs (`GOOGLE_CLOUD_PROJECT=floci-local`, `FIRESTORE_EMULATOR_HOST=localhost:4588`):

- **Cloud Firestore (`@google-cloud/firestore` over gRPC):**  
  Stores service requests (including `statusHistory` and `assignedDepartment`), official announcements, community posts, campus decisions, and synthetic profiles in Firestore collections (`serviceRequests`, `announcements`, `posts`, `syntheticProfiles`). Data survives backend Node.js server restarts because Floci runs as an independent Docker container.
- **Cloud Logging (`@google-cloud/logging` over insecure gRPC):**  
  Records a structured audit log entry (`campusserve-api-audit`) for every request API operation (`CREATE_REQUEST`, `GET_REQUEST`, `LIST_REQUESTS`, `UPDATE_STATUS`, `INVALID_INPUT`, `INVALID_TRANSITION`). Every entry passes through a strict 6-field whitelist (`buildSafeLogEntry()` in `src/backend/adapters/loggingAdapter.js`) containing **only**:
  `{ timestamp, requestId, operation, result, statusCode, latencyMs }`.  
  Descriptions, student references (`STU-XXXX`), room locations, login payloads, post bodies, and chat prompts are **strictly stripped** and never written to logs.
- **Cloud Run (`src/backend/Dockerfile` + Cloud Run v2 REST):**  
  The backend is packaged in a production-ready Alpine container (`src/backend/Dockerfile`, port `4000`) and registers/verifies the `campusserve-api` service against Floci's Cloud Run v2 API (`/v2/projects/floci-local/locations/us-central1/services`), while the live Express process handles local traffic on `http://localhost:4000`.
- **Honest Verification & Adapter Status (`verified-emulator` vs. `labeled-local-adapter`):**  
  `GET /api/health` actively probes Firestore, Cloud Logging, and Cloud Run and exposes the exact status of each service in the top navigation bar and the **Logs & Cloud Verify** page:
  - **`verified-emulator`**: Live operations succeeded directly against Floci at `localhost:4588`.
  - **`labeled-local-adapter`**: If Floci is unreachable or any operation returns an unimplemented error, the adapter automatically routes reads and writes to disk under `src/backend/local-data/` (`requests.json`, `logs.json`, `announcements.json`, `posts.json`, `profiles.json`) and labels itself honestly instead of faking cloud status.

---

## 2. Complete List of Features & What Users Can Perform

### A. Synthetic Role-Based Login & Theme System
*(Implemented in `AuthScreen.jsx`, `ThemePicker.jsx`, `Dashboards.jsx` → `/api/auth/login`, `/api/auth/register`)*
- **1-Click Synthetic Demo Login:** Sign in immediately as **Student (`STU-1042`)**, **Faculty (`FAC-201`)**, or **Admin (`ADM-001`)** with a clear *"Synthetic Lab Mode — No Real Personal Data"* badge.
- **Custom Synthetic Sign-In & Profile Creation:** Enter any synthetic ID matching `STU-XXXX`, `FAC-XXX`, or `ADM-XXX` (3–6 digits), or create a synthetic profile with department and semester. Real email fields are rejected with HTTP `400`.
- **Switch Role & Profile View:** Open the user menu in the top-right header to inspect locked synthetic identity fields, view tickets under your `STU-XXXX` ID, or switch roles anytime.
- **Live 5-Theme Picker:** Switch between **Midnight**, **Aurora**, **Violet**, **Ember**, and **Daylight** glassmorphism themes from the header; the choice persists in `localStorage`.

### B. Student & Admin Home Dashboards
*(Implemented in `Dashboards.jsx`, `App.jsx` → `/api/requests`, `/api/analytics`, `/api/seed`)*
- **Top Telemetry & Demo Seeding:** Every authenticated screen shows the live **`Floci GCP Connected • localhost:4588`** status pill (`FS: verified-emulator • Log: verified-emulator`) and the **Seed Synthetic Demo Data** button (`POST /api/seed`), which populates 4 BMSCE requests, 3 announcements, 3 posts, and 3 campus decisions idempotently.
- **Student / Faculty Home:** Displays 4 KPI summary cards (**Total Requests**, **Submitted / Open**, **In Progress**, **Resolved / Closed**), a **Quick Submit Request** card with BMSCE room autocomplete, recent requests with progress bars, community feed highlights, active campus decisions, and official notices.
- **Admin Command Centre:** Displays 6 KPI cards (adding **SLA Overdue** beyond 48 hours and **Decisions**), a **Department Routing Overview** across all 9 BMSCE sectors, a **Priority Open Queue** with 1-click **Assign** / **Start Progress** buttons, and Command Shortcuts.

### C. Service Request Submission & Auto-Routing
*(Implemented in `RequestsWorkspace.jsx` → `Submit Request`, `POST /api/requests`, `campusData.js`)*
- **Strict Category & BMSCE Location Selection:** Choose from the 3 validated categories (`Classroom Maintenance`, `IT Support`, `Facilities`) and type or pick a room from the 24-location BMSCE datalist (`3–80` characters).
- **Description & Draft Helper:** Enter a `10–500` character issue description with a live character counter and a **Polish draft** helper button.
- **Strict `400` Validation Guardrail:** Submitting an invalid category, short location/description, or a real-looking name (e.g., `"Rohan Sharma"` instead of `STU-XXXX`) triggers an inline **Validation Error (HTTP 400)** banner listing every field error.
- **Auto-Department Routing & Non-Guessable ID:** Valid submissions generate a 64-bit cryptographic ID (`REQ-` + 16 hex chars via `crypto.randomBytes(8)`), initialize status to `Submitted`, automatically assign `assignedDepartment` across 9 BMSCE sectors (e.g., `IT Services`, `Data Center`, `Electrical & HVAC`), and display a confirmation card with **Copy ID** and **Track Request →** buttons.

### D. Request Tracking & Audit Timeline
*(Implemented in `RequestsWorkspace.jsx` → `Track Request`, `ErrorViews.jsx` → `GET /api/requests/:id`)*
- **Search & 1-Click Recent ID Chips:** Look up any ticket from the Track search bar, the top header search box, or by clicking any recent `REQ-...` chip.
- **4-Step Visual Progress Stepper:** Displays real-time lifecycle progress across `Submitted → Assigned → In progress → Resolved / Closed`.
- **Full `statusHistory` Audit Timeline:** Shows every state transition chronologically (`fromStatus → toStatus`, `changedBy`, and timestamp) plus ticket metadata (`Category`, `Department`, `Synthetic Ref`, `Created`).
- **Controlled `404` Error View:** Clicking **Test Unknown ID (404)** (or searching `REQ-0000000000000000`) renders a clean `404 · Not found` glass error card.

### E. Status Lifecycle Console & Guardrail Testing
*(Implemented in `RequestsWorkspace.jsx` → `Status Console`, `SectorRoutingView.jsx` → `PATCH /api/requests/:id/status`)*
- **Filterable Status Table:** Filter tickets by status pill (`All`, `Submitted`, `Assigned`, `In progress`, `Resolved`, `Closed`) or search by ID, location, department, or `STU-` ref.
- **Only Valid Next-State Action Buttons:** Each row exposes strictly the legal transitions allowed from its current state:
  - `Submitted` → **Assign** (`Assigned`)
  - `Assigned` → **Start Progress** (`In progress`)
  - `In progress` → **Resolve** (`Resolved`) or **Close** (`Closed`)
  - `Resolved` → **Close** (`Closed`)
  - `Closed` → *(Terminal — no actions)*
- **Live Invalid Jump Guardrail Demo:** Every row includes a **Test Invalid Jump** button that intentionally submits an illegal transition (such as `Submitted → Resolved`) and displays the live **HTTP 400 Rejected — State Guardrail Enforced** banner with `allowedNextStates`.
- **Sector Routing Kanban Board (Admin):** Visualizes all tickets grouped across the 9 BMSCE support sectors (`IT Services`, `Data Center`, `Infrastructure & Facilities`, `Electrical & HVAC`, `Lab Equipment`, `Library & Exam Cell`, `Security & Safety`, `Cleanliness & Waste`, `Hostel & Welfare`) with inline transition buttons.

### F. BMSCE Campus Directory, Announcements, Community Posts & Decisions
*(Implemented in `LocationsView.jsx`, `CommunityViews.jsx`)*
- **Campus Directory (`GET /api/locations`):** Browse and filter 24 BMSCE classrooms, labs, libraries, study decks, and offices across 6 buildings (`Main Block (A)`, `B Block`, `C Block`, `D Block`, `Central Library`, `Annex Block`), see their assigned support department, and click **Report issue →** to pre-fill a service request for that room.
- **Official Announcements (`GET/POST /api/announcements`):** View campus-wide notices; Faculty (`FAC-`) and Admin (`ADM-`) sessions can publish new notices directly to Firestore.
- **Community Posts (`GET/POST /api/posts`, `POST /api/posts/:id/vote`):** Create posts across 5 categories (`Campus life`, `Academics`, `Study spots`, `Clubs & events`, `Lost & found`), toggle upvotes, add emoji reactions (`👍`, `🔥`, `💡`, `😂`, `👏`), and open post detail cards.
- **Campus Decisions (`GET/POST /api/posts`, `POST /api/posts/:id/vote`):** Review `Active`, `Upcoming`, and `Implemented` campus proposals, cast an anonymous synthetic ballot (duplicate votes blocked via SHA-256 hash of `voterRef:decisionId`), receive a 12-character verification receipt, and create new active proposals when signed in as Admin.

### G. CampusBot Assistant & Notifications
*(Implemented in `CampusBotView.jsx`, `AdminInsightsViews.jsx` → `POST /api/campusbot`, `GET /api/notifications`)*
- **Interactive CampusBot:** Ask natural-language questions or click quick-prompt chips to get category/location recommendations, SLA/lifecycle explanations, or paste any `REQ-...` ID for a live Firestore status lookup with a direct **Open Stepper →** shortcut.
- **Notifications Feed:** Aggregates recent status changes on tickets (filtered for Student sessions) and recent official announcements with 1-click ticket inspection.

### H. Admin Analytics, Audit & Cloud Privacy Verification
*(Implemented in `AdminInsightsViews.jsx`, `CloudVerificationView.jsx` → `GET /api/analytics`, `GET /api/audit`, `GET /api/health`, `GET /api/logs`)*
- **Admin Analytics:** Displays a conic-gradient Resolution Rate ring plus breakdowns by **Department / Sector Load**, **Status**, **Category**, and **Campus Block**.
- **Redacted Audit Log:** Lists every `statusHistory` transition across all requests without exposing issue descriptions or student refs.
- **Logs & Cloud Verification:** Displays live verification cards for **Cloud Run**, **Cloud Firestore**, and **Cloud Logging**, alongside the **Privacy-Safe Structured Log Viewer** (switchable between **Table** and **Raw JSON**) proving zero PII or descriptions ever appear in Cloud Logging.

---

## 3. Step-by-Step 7–10 Minute Live Evaluation Demo Script

*Tailored for the **BMSCE Cloud Computing Skill Lab Review – 2** rubric. Start with Floci (`localhost:4588`), Backend (`localhost:4000`), and Frontend (`localhost:5173`) running.*

### Minute 0:00–1:30 — Problem Statement, Architecture & Synthetic Login
1. Open **`http://localhost:5173`** in Chrome.
2. Point out the **Floci GCP Connected • localhost:4588** status badge in the top header and toggle the **Theme Picker** (e.g., switch between `Midnight` and `Daylight` to show the responsive theme system).
3. Explain the problem: CampusServe replaces scattered campus complaints with one cloud-backed workflow using **Synthetic Lab Mode** (zero real student PII).
4. Click **Student STU-1042** under *1-Click Synthetic Demo Login*.
5. If KPI cards show `0`, click **Seed Synthetic Demo Data** in the top bar to populate sample BMSCE tickets, notices, posts, and decisions.

### Minute 1:30–3:30 — Submitting a Synthetic Request, Auto-Routing & `400` Validation
1. Click **Requests & Track** in the left sidebar (opens **Submit Request**).
2. **Demonstrate `400` Validation Rejection (T04):**
   - Select any category, type `"AB"` in Room/Location, `"short"` in Description, and `"Rohan Sharma"` in Synthetic Student Ref, then click **Submit Service Request**.
   - Point out the red **Validation Error (HTTP 400)** banner rejecting short fields and non-synthetic student refs.
3. **Submit a Valid Synthetic Ticket (T01):**
   - Category: `IT Support`
   - Room / Location: pick `Main Block (A) · A-303 CSE Lab 2` from the dropdown
   - Synthetic Student Ref: `STU-1042`
   - Description: `Projector HDMI switcher drops signal after 10 minutes during lab.`
   - Click **Submit Service Request**.
4. Show the green **HTTP 201 Created** confirmation card: highlight the non-guessable `REQ-...` ID (`crypto.randomBytes(8)`), the auto-routed **`IT Services`** sector chip, click **Copy ID**, and click **Track Request →**.

### Minute 3:30–5:30 — Tracking, `404` Handling & Status Lifecycle Guardrails
1. In **Track Request**, show the 4-step progress stepper (`Submitted` active), ticket metadata, and initial `statusHistory` timeline (T02).
2. Click **Test Unknown ID (404)** (`REQ-0000000000000000`) to show the controlled **`404 · Not found`** error view (T03).
3. Click a **Recent Request ID** chip to return to a live ticket, then switch to the **Status Console** sub-tab.
4. **Demonstrate the `400` Invalid Transition Guardrail (T05):**
   - On your newly `Submitted` ticket, click **Test Invalid Jump** (which attempts `Submitted → Resolved`).
   - Show the live **HTTP 400 Rejected — State Guardrail Enforced** banner confirming the record stayed `Submitted`.
5. **Execute Legal Transitions:**
   - Click **Assign** (`Submitted → Assigned`), then **Start Progress** (`Assigned → In progress`), then **Resolve** (`In progress → Resolved`), then **Close** (`Resolved → Closed`).
   - Click the `REQ-...` ID to show all 4 stepper stages complete and the full `statusHistory` audit trail.

### Minute 5:30–7:00 — Integrated CampusServe Features Tour
1. Open **Campus Directory** (`locations`): filter by building (e.g., `Central Library`) and highlight the assigned support department per room.
2. Open **Campus Decisions**: open the active library hours proposal, cast an anonymous ballot, and point out the 12-character SHA-256 verification receipt.
3. Open **CampusBot**: click a quick chip or paste your `REQ-...` ID to show live Firestore ticket lookup.
4. Click the top-right user chip → **Switch Role / Sign Out** → click **Admin ADM-001** to show **Admin Dashboard**, **Sector Routing** (9-sector Kanban board), and **Analytics** (resolution ring + department/status/category charts).

### Minute 7:00–8:30 — Privacy-Safe Cloud Logging & Automated Test Evidence (T01–T08)
1. Open **Logs & Cloud Verify** from the sidebar.
2. Point out the 3 service verification cards (**Cloud Run**, **Cloud Firestore**, **Cloud Logging**) all showing **`verified-emulator`** against `http://localhost:4588`.
3. Inspect the **Privacy-Safe Structured Log Viewer** (toggle **Table** and **Raw JSON**): prove that `description`, `requesterRef`, `location`, login payloads, and posts are **completely absent**—only `{ timestamp, requestId, operation, result, statusCode, latencyMs }` appear (T06).
4. Open `evidence/test-matrix-results.md` (or run `npm test` in a terminal with port `4000` stopped) to show all **8/8 tests passing**, highlighting **T07** (backend process stop/restart persistence) and **T08** (`/api/health` matching live Floci capabilities).

---

## 4. Quick Viva / Evaluator Q&A Cheat Sheet

1. **How do you prevent request ID guessing or enumeration?**  
   Every ticket ID is generated server-side using `crypto.randomBytes(8).toString('hex')` prefixed with `REQ-` (64 bits of cryptographic randomness, e.g., `REQ-a6b6213610b5e717`), rather than sequential integers like `1, 2, 3`.

2. **How do you guarantee student privacy and zero PII in Cloud Logging?**  
   First, input validation and auth enforce synthetic IDs (`STU-XXXX`, `FAC-XXX`, `ADM-XXX`) and reject real email fields (`POST /api/auth/register`) or name strings in `requesterRef` (`POST /api/requests`). Second, `buildSafeLogEntry()` constructs every Cloud Logging payload from a strict 6-key whitelist (`timestamp`, `requestId`, `operation`, `result`, `statusCode`, `latencyMs`), so descriptions, `requesterRef`, locations, headers, and bodies can never enter a log entry.

3. **What happens if the Node.js backend server restarts—does data survive?**  
   Yes. Primary persistence writes via `@google-cloud/firestore` to the separate `floci-gcp` Docker container on `localhost:4588` (which runs independently of the Node.js process). Test **T07** in `tests/run-tests.mjs` explicitly kills the Express server, spawns a new process, and retrieves the `T01` ticket intact. If Floci is ever unavailable, the adapter writes to disk under `src/backend/local-data/` so state still survives restarts.

4. **How are invalid status jumps blocked?**  
   `PATCH /api/requests/:id/status` checks `ALLOWED_TRANSITIONS` in `src/backend/validation.js` (`Submitted → ["Assigned"]`, `Assigned → ["In progress"]`, `In progress → ["Resolved", "Closed"]`, `Resolved → ["Closed"]`, `Closed → []`). Any disallowed jump returns HTTP `400` with `currentStatus` and `allowedNextStates` **before** any Firestore write executes, leaving the stored document untouched.

5. **What does Floci emulate natively vs. what is adapted?**  
   On Floci `v0.13.0`, **Cloud Firestore** (gRPC emulator host), **Cloud Logging** (gRPC insecure channel), and **Cloud Run v2** (service registration/control-plane REST API) all operate in `verified-emulator` mode. Because Floci Cloud Run v2 emulates control-plane metadata rather than hosting live container traffic, the Express API runs directly on Node.js port `4000` locally while providing a verified `src/backend/Dockerfile` for real Cloud Run deployment—and every adapter automatically switches to `labeled-local-adapter` disk storage if any Floci call fails.
