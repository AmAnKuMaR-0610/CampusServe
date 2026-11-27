# Floci GCP Emulator Verification Report

- **Target Endpoint:** `http://localhost:4588`
- **Container:** `floci-gcp` (`floci/floci-gcp:latest`, Version `0.13.0`, Community Edition)
- **Project ID:** `floci-local`
- **Evidence Baseline:** `evidence/floci-status-2026-11-27.txt`, `evidence/floci-services-2026-11-27.txt`

---

## Verification Summary

| GCP Service | Active Mode in `/api/health` | SDK / Transport Used | Verified Operations on Floci `v0.13.0` | Honest Limitations & Fallback Behaviour |
| :--- | :--- | :--- | :--- | :--- |
| **Cloud Firestore** | `verified-emulator` (`mode: "emulator"`) | `@google-cloud/firestore` (`FIRESTORE_EMULATOR_HOST=localhost:4588`, gRPC) | `doc.set()`, `doc.get()`, `collection.orderBy('createdAt', 'desc').get()`, `doc.update()`, `doc.delete()` | REST `/v1/projects/.../documents` returned `404` and `preferRest: true` fails with `NO_ADC_FOUND` without real GCP keys. Default gRPC emulator transport works natively. Falls back to `src/backend/local-data/requests.json` (`labeled-local-adapter`) if any op errors. |
| **Cloud Logging** | `verified-emulator` (`mode: "emulator"`) | `@google-cloud/logging` (`servicePath: 'localhost'`, `port: 4588`, `grpc.credentials.createInsecure()`) | `log.write()`, `logging.getEntries()` (plus REST `/v2/entries:write` & `/v2/entries:list` `200`) | Default `Logging` constructor without insecure gRPC credentials fails with `NO_ADC_FOUND`. Passing `sslCreds: grpc.credentials.createInsecure()` works natively against Floci without real credentials. Falls back to `src/backend/local-data/logs.json` (`labeled-local-adapter`) if any op errors. |
| **Cloud Run** | `verified-emulator` (`mode: "emulator"`) | Cloud Run v2 REST (`/v2/projects/floci-local/locations/us-central1/services`) + `src/backend/Dockerfile` | `GET .../services` (`200`), `POST .../services?serviceId=campusserve-api` (`200`, assigns `serviceUri`), `DELETE` (`200`) | Floci Cloud Run v2 emulates the control-plane service resource and URI metadata (`http://campusserve-api-1efb2c36c23f.us-central1.run.localhost.floci.io:4588`), while the live Express runtime executes locally on Node.js port `4000` and is verified container-buildable via `src/backend/Dockerfile`. |

---

## Probe Evidence & Resilience Design

1. **Zero Real GCP Credentials:** No service account JSON keys or `gcloud auth` sessions are required. Both Firestore and Cloud Logging SDKs communicate directly with `localhost:4588` using emulator/insecure channels.
2. **Automatic Fallback (`labeled-local-adapter`):** Each adapter wraps every SDK call in a `try/catch`. If Floci becomes unreachable or returns an unimplemented error for a specific operation, the adapter transparently routes reads/writes to `src/backend/local-data/` (`requests.json` / `logs.json`) and flips `/api/health` for that service to `status: "labeled-local-adapter"` with `fallbackReason` populated.
3. **Persistence Across Application Restarts:** Verified in automated test **T07** (`tests/run-tests.mjs`): stopping the Express server process and launching a fresh process successfully retrieves previously created `REQ-...` documents from Floci Firestore.
