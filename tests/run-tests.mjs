import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const BACKEND_ENTRY = path.join(ROOT_DIR, 'src', 'backend', 'server.js');
const EVIDENCE_DIR = path.join(ROOT_DIR, 'evidence');

const PORT = Number(process.env.TEST_PORT || 4000);
const BASE_URL = `http://127.0.0.1:${PORT}`;
const FLOCI_URL = process.env.FLOCI_ENDPOINT || 'http://localhost:4588';

function startBackend() {
  const child = spawn(process.execPath, [BACKEND_ENTRY], {
    cwd: ROOT_DIR,
    env: {
      ...process.env,
      PORT: String(PORT),
      GOOGLE_CLOUD_PROJECT: process.env.GOOGLE_CLOUD_PROJECT || 'floci-local',
      FIRESTORE_EMULATOR_HOST: process.env.FIRESTORE_EMULATOR_HOST || 'localhost:4588',
      FLOCI_ENDPOINT: FLOCI_URL,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let stderr = '';
  child.stderr.on('data', (chunk) => {
    stderr += chunk.toString();
  });

  return { child, getStderr: () => stderr };
}

async function waitForHealth(timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE_URL}/api/health`);
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Server still starting
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Backend server did not become healthy on ${BASE_URL} within ${timeoutMs}ms`);
}

async function stopBackend(child) {
  if (!child || child.killed) return;
  await new Promise((resolve) => {
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      resolve();
    }, 3000);
    child.once('exit', () => {
      clearTimeout(timer);
      resolve();
    });
    child.kill();
  });
}

async function runTests() {
  const results = [];
  const startedAt = new Date().toISOString();

  let serverProc = startBackend();
  let t01Id = null;
  let logsSnapshot = null;
  let healthSnapshot = null;

  const syntheticMarker = {
    category: 'IT Support',
    location: 'CSE Block - Seminar 204',
    description: 'Synthetic T01 test: projector HDMI switcher drops signal after 10 minutes.',
    requesterRef: 'STU-9910',
  };

  async function record(id, name, fn) {
    const t0 = Date.now();
    try {
      const details = await fn();
      results.push({ id, name, status: 'PASS', durationMs: Date.now() - t0, details });
      console.log(`PASS ${id}: ${name} (${details})`);
    } catch (err) {
      results.push({ id, name, status: 'FAIL', durationMs: Date.now() - t0, details: err.message });
      console.error(`FAIL ${id}: ${name} -> ${err.message}`);
      throw err;
    }
  }

  try {
    await waitForHealth();

    // T01: Submit valid synthetic request -> 201 + unique REQ-... ID and persists
    await record('T01', 'Submit valid synthetic request -> 201 + unique REQ-... ID', async () => {
      const res = await fetch(`${BASE_URL}/api/requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(syntheticMarker),
      });
      assert.equal(res.status, 201, `Expected 201, got ${res.status}`);
      const body = await res.json();
      assert.match(body.requestId, /^REQ-[a-f0-9]{16}$/);
      assert.equal(body.status, 'Submitted');
      assert.equal(body.category, syntheticMarker.category);
      assert.equal(body.location, syntheticMarker.location);
      assert.equal(body.requesterRef, syntheticMarker.requesterRef);
      assert.ok(Array.isArray(body.statusHistory) && body.statusHistory.length === 1);
      t01Id = body.requestId;
      return `Created ${t01Id} with status=${body.status}`;
    });

    // T02: Look up existing ID -> 200 with current status and fields
    await record('T02', 'Look up existing request ID -> 200 + fields', async () => {
      const res = await fetch(`${BASE_URL}/api/requests/${t01Id}`);
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.requestId, t01Id);
      assert.equal(body.status, 'Submitted');
      assert.equal(body.description, syntheticMarker.description);
      return `Retrieved ${t01Id} (status=${body.status})`;
    });

    // T03: Look up unknown ID -> controlled 404
    await record('T03', 'Look up unknown ID (REQ-0000000000000000) -> controlled 404', async () => {
      const res = await fetch(`${BASE_URL}/api/requests/REQ-0000000000000000`);
      assert.equal(res.status, 404);
      const body = await res.json();
      assert.equal(body.error, 'Service request not found');
      return `Returned HTTP 404 with error="${body.error}"`;
    });

    // T04: Submit missing/invalid fields -> rejected safely with 400
    await record('T04', 'Reject invalid/PII-looking fields safely with 400', async () => {
      const res = await fetch(`${BASE_URL}/api/requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: 'Free Food',
          location: 'AB',
          description: 'short',
          requesterRef: 'Rohan Sharma',
        }),
      });
      assert.equal(res.status, 400);
      const body = await res.json();
      assert.equal(body.error, 'Validation failed');
      assert.ok(Array.isArray(body.details) && body.details.length >= 4);
      return `Rejected with HTTP 400 (${body.details.length} field errors)`;
    });

    // T05: Attempt invalid status transition (Submitted -> Resolved) -> 400 & unchanged
    await record('T05', 'Reject invalid transition (Submitted -> Resolved) with 400 & unchanged state', async () => {
      const res = await fetch(`${BASE_URL}/api/requests/${t01Id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'Resolved' }),
      });
      assert.equal(res.status, 400);
      const body = await res.json();
      assert.equal(body.currentStatus, 'Submitted');
      assert.deepEqual(body.allowedNextStates, ['Assigned']);

      const checkRes = await fetch(`${BASE_URL}/api/requests/${t01Id}`);
      const checkBody = await checkRes.json();
      assert.equal(checkBody.status, 'Submitted');
      assert.equal(checkBody.statusHistory.length, 1);
      return `Rejected Submitted -> Resolved; persisted status remains "${checkBody.status}"`;
    });

    // T06: Inspect /api/logs -> zero occurrences of description, requesterRef, location, or secrets
    await record('T06', 'Inspect /api/logs -> zero PII, descriptions, requesterRef, or secrets', async () => {
      const res = await fetch(`${BASE_URL}/api/logs?limit=50`);
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.ok(Array.isArray(body.logs) && body.logs.length > 0);
      const serialized = JSON.stringify(body.logs);

      assert.equal(serialized.includes(syntheticMarker.description), false, 'Log leaked description!');
      assert.equal(serialized.includes(syntheticMarker.requesterRef), false, 'Log leaked requesterRef!');
      assert.equal(serialized.includes(syntheticMarker.location), false, 'Log leaked location!');
      assert.equal(serialized.includes('Rohan Sharma'), false, 'Log leaked invalid requesterRef!');
      assert.equal(serialized.includes('authorization'), false, 'Log leaked authorization header!');

      const allowedKeys = new Set(['timestamp', 'requestId', 'operation', 'result', 'statusCode', 'latencyMs']);
      for (const entry of body.logs) {
        for (const key of Object.keys(entry)) {
          assert.ok(allowedKeys.has(key), `Unexpected log key: ${key}`);
        }
      }
      logsSnapshot = body;
      return `Verified ${body.logs.length} log entries contain only allowed metadata keys`;
    });

    // T07: Stop & restart backend server process, then retrieve T01 request ID
    await record('T07', 'Restart backend server and verify T01 record persistence', async () => {
      await stopBackend(serverProc.child);
      serverProc = startBackend();
      await waitForHealth();

      const res = await fetch(`${BASE_URL}/api/requests/${t01Id}`);
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.requestId, t01Id);
      assert.equal(body.status, 'Submitted');
      assert.equal(body.description, syntheticMarker.description);
      return `Restarted backend PID=${serverProc.child.pid}; retrieved ${t01Id} intact`;
    });

    // T08: Verify /api/health service claims match verified Floci capabilities
    await record('T08', 'Verify /api/health service claims match live Floci capabilities', async () => {
      const flociRes = await fetch(`${FLOCI_URL}/health`);
      assert.equal(flociRes.status, 200);
      const flociData = await flociRes.json();

      const healthRes = await fetch(`${BASE_URL}/api/health`);
      assert.equal(healthRes.status, 200);
      const healthData = await healthRes.json();

      assert.equal(healthData.flociEndpoint, FLOCI_URL);
      assert.equal(flociData.services.firestore, 'running');
      assert.equal(flociData.services.logging, 'running');
      assert.equal(flociData.services.cloudrun, 'running');
      assert.ok(['verified-emulator', 'labeled-local-adapter'].includes(healthData.services.firestore.status));
      assert.ok(['verified-emulator', 'labeled-local-adapter'].includes(healthData.services.logging.status));
      assert.ok(['verified-emulator', 'labeled-local-adapter'].includes(healthData.services.cloudRun.status));
      assert.ok(healthData.totalRequests >= 1);

      healthSnapshot = healthData;
      return `Floci v${flociData.version} matched; FS=${healthData.services.firestore.status}, Log=${healthData.services.logging.status}, Run=${healthData.services.cloudRun.status}`;
    });

    // Save evidence files
    await fs.mkdir(EVIDENCE_DIR, { recursive: true });
    await fs.writeFile(
      path.join(EVIDENCE_DIR, 'redacted-logs-evidence.json'),
      JSON.stringify(
        {
          capturedAt: new Date().toISOString(),
          flociEndpoint: FLOCI_URL,
          redactionPolicy: logsSnapshot.redactionPolicy,
          totalEntriesCaptured: logsSnapshot.count,
          entries: logsSnapshot.logs,
        },
        null,
        2,
      ),
      'utf8',
    );

    const mdLines = [
      '# CampusServe Automated Test Matrix Results (T01–T08)',
      '',
      `- **Executed At:** ${startedAt}`,
      `- **Backend Target:** ${BASE_URL}`,
      `- **Floci Endpoint:** ${FLOCI_URL}`,
      `- **Firestore Mode:** ${healthSnapshot.services.firestore.status}`,
      `- **Cloud Logging Mode:** ${healthSnapshot.services.logging.status}`,
      `- **Cloud Run Mode:** ${healthSnapshot.services.cloudRun.status}`,
      '',
      '| Test ID | Test Case | Status | Duration (ms) | Observed Evidence |',
      '| :--- | :--- | :--- | ---: | :--- |',
      ...results.map((r) => `| **${r.id}** | ${r.name} | **${r.status}** | ${r.durationMs} | ${r.details} |`),
      '',
      `All ${results.length}/${results.length} handbook verification tests passed.`,
      '',
    ];
    await fs.writeFile(path.join(EVIDENCE_DIR, 'test-matrix-results.md'), mdLines.join('\n'), 'utf8');

    console.log(`\nALL ${results.length}/${results.length} TESTS PASSED. Evidence saved to evidence/`);
  } finally {
    await stopBackend(serverProc?.child);
  }
}

runTests().catch((err) => {
  console.error('\nTEST SUITE FAILED:', err);
  process.exit(1);
});
