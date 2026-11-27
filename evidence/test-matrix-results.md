# CampusServe Automated Test Matrix Results (T01–T08)

- **Executed At:** 2026-11-27T16:15:37.546Z
- **Backend Target:** http://127.0.0.1:4000
- **Floci Endpoint:** http://localhost:4588
- **Firestore Mode:** verified-emulator
- **Cloud Logging Mode:** verified-emulator
- **Cloud Run Mode:** verified-emulator

| Test ID | Test Case | Status | Duration (ms) | Observed Evidence |
| :--- | :--- | :--- | ---: | :--- |
| **T01** | Submit valid synthetic request -> 201 + unique REQ-... ID | **PASS** | 66 | Created REQ-a6b6213610b5e717 with status=Submitted |
| **T02** | Look up existing request ID -> 200 + fields | **PASS** | 28 | Retrieved REQ-a6b6213610b5e717 (status=Submitted) |
| **T03** | Look up unknown ID (REQ-0000000000000000) -> controlled 404 | **PASS** | 27 | Returned HTTP 404 with error="Service request not found" |
| **T04** | Reject invalid/PII-looking fields safely with 400 | **PASS** | 15 | Rejected with HTTP 400 (4 field errors) |
| **T05** | Reject invalid transition (Submitted -> Resolved) with 400 & unchanged state | **PASS** | 52 | Rejected Submitted -> Resolved; persisted status remains "Submitted" |
| **T06** | Inspect /api/logs -> zero PII, descriptions, requesterRef, or secrets | **PASS** | 27 | Verified 29 log entries contain only allowed metadata keys |
| **T07** | Restart backend server and verify T01 record persistence | **PASS** | 1136 | Restarted backend PID=16836; retrieved REQ-a6b6213610b5e717 intact |
| **T08** | Verify /api/health service claims match live Floci capabilities | **PASS** | 42 | Floci v0.13.0 matched; FS=verified-emulator, Log=verified-emulator, Run=verified-emulator |

All 8/8 handbook verification tests passed.
