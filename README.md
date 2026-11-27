# CampusServe — BMSCE Cloud Service Desk

CampusServe is a cloud-native student service request platform built for BMSCE, running locally against the **Floci GCP Emulator (`v0.13.0`)** on `http://localhost:4588`. It implements strict schema validation, cryptographically random non-guessable request IDs, a controlled state-machine lifecycle, zero-PII structured Cloud Logging, and resilient disk-backed fallback adapters.

---

## Architecture Overview

- **Frontend (`src/frontend`)**: React 18 + Vite + Tailwind CSS v4 + Lucide icons running on port `5173`, proxying `/api` to `http://localhost:4000`.
- **Backend (`src/backend`)**: Node.js + Express ESM API running on port `4000`, using official `@google-cloud/firestore` and `@google-cloud/logging` SDKs plus Cloud Run v2 service registration and a production `Dockerfile`.
- **Emulator (`floci-gcp`)**: Local Floci GCP emulator container running on `http://localhost:4588` (`GOOGLE_CLOUD_PROJECT=floci-local`, `FIRESTORE_EMULATOR_HOST=localhost:4588`).
- **Tests & Evidence (`tests/`, `evidence/`)**: Automated T01–T08 handbook verification runner (`npm test`) and captured test/redaction evidence.

---

## Prerequisites

- **Node.js** `v20+` (verified on `v24.22.1`) and **npm**
- **Floci GCP Emulator (`v0.13.0`)** running at `http://localhost:4588` (container name `floci-gcp`)

### 1. Verify Floci GCP Emulator (Do NOT overwrite running container)

Check that Floci is healthy and reachable on port `4588`:

```powershell
curl http://localhost:4588/health
```

If Floci is not running on a fresh machine, start it with:

```powershell
docker run -d --name floci-gcp -p 4588:4588 floci/floci-gcp:latest
```

### 2. Install Dependencies

```powershell
npm --prefix src/backend install
npm --prefix src/frontend install
```

### 3. Start the Backend API (Port `4000`)

```powershell
$env:GOOGLE_CLOUD_PROJECT="floci-local"
$env:FIRESTORE_EMULATOR_HOST="localhost:4588"
npm run dev:backend
```

### 4. Start the Frontend Portal (Port `5173`)

In a second terminal:

```powershell
npm run dev:frontend
```

Open `http://localhost:5173` in your browser. Click **Seed Synthetic Demo Data** in the top bar to populate 4 synthetic BMSCE service requests across different statuses.

### 5. Run the Automated T01–T08 Test Suite

Ensure port `4000` is free (the test runner starts, stops, and restarts the backend automatically for T07):

```powershell
npm test
```

Results are written to:
- `evidence/test-matrix-results.md`
- `evidence/redacted-logs-evidence.json`

### 6. Build the Cloud Run Container Image

```powershell
docker build -t campusserve-backend:local src/backend
```
