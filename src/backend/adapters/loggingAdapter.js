import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Logging } from '@google-cloud/logging';
import { grpc } from 'google-gax';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOCAL_DATA_DIR = path.resolve(__dirname, '../local-data');
const LOCAL_LOGS_FILE = path.join(LOCAL_DATA_DIR, 'logs.json');
const LOG_NAME = 'campusserve-api-audit';

/**
 * Strictly constructs a privacy-safe log record containing ONLY allowed fields.
 * Never passes through description, requesterRef, location, headers, or bodies.
 */
export function buildSafeLogEntry({
  timestamp = new Date().toISOString(),
  requestId = null,
  operation,
  result,
  statusCode,
  latencyMs,
}) {
  return {
    timestamp: String(timestamp),
    requestId: requestId ? String(requestId) : null,
    operation: String(operation),
    result: String(result),
    statusCode: Number(statusCode),
    latencyMs: Number(Number(latencyMs).toFixed(2)),
  };
}

/**
 * Cloud Logging adapter targeting the local Floci GCP emulator via @google-cloud/logging,
 * with automatic fallback to disk-backed JSON under src/backend/local-data/.
 */
export class LoggingAdapter {
  constructor({ projectId, endpointHost, endpointPort }) {
    this.projectId = projectId;
    this.endpointHost = endpointHost;
    this.endpointPort = Number(endpointPort);
    this.mode = 'emulator';
    this.status = 'verified-emulator';
    this.lastError = null;

    this.logging = new Logging({
      projectId,
      servicePath: this.endpointHost,
      port: this.endpointPort,
      sslCreds: grpc.credentials.createInsecure(),
    });
    this.log = this.logging.log(LOG_NAME);
  }

  async _ensureLocalDir() {
    await fs.mkdir(LOCAL_DATA_DIR, { recursive: true });
  }

  async _readLocalLogs() {
    await this._ensureLocalDir();
    try {
      const raw = await fs.readFile(LOCAL_LOGS_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.map(buildSafeLogEntry) : [];
    } catch (err) {
      if (err.code === 'ENOENT') return [];
      throw err;
    }
  }

  async _appendLocalLog(safeEntry) {
    const existing = await this._readLocalLogs();
    existing.unshift(safeEntry);
    const trimmed = existing.slice(0, 500);
    await fs.writeFile(LOCAL_LOGS_FILE, JSON.stringify(trimmed, null, 2), 'utf8');
  }

  _markFallback(err) {
    this.mode = 'adapter';
    this.status = 'labeled-local-adapter';
    this.lastError = err?.message || String(err);
  }

  _markEmulatorVerified() {
    this.mode = 'emulator';
    this.status = 'verified-emulator';
    this.lastError = null;
  }

  async probe() {
    try {
      await this.logging.getEntries({
        filter: `logName="projects/${this.projectId}/logs/${LOG_NAME}"`,
        pageSize: 1,
      });
      this._markEmulatorVerified();
    } catch (err) {
      this._markFallback(err);
    }
    return this.getHealth();
  }

  async write(rawEntry) {
    const safeEntry = buildSafeLogEntry(rawEntry);
    try {
      const entry = this.log.entry(
        {
          resource: { type: 'global' },
          severity: safeEntry.statusCode >= 400 ? 'WARNING' : 'INFO',
        },
        safeEntry,
      );
      await this.log.write(entry);
      this._markEmulatorVerified();
      return safeEntry;
    } catch (err) {
      this._markFallback(err);
      await this._appendLocalLog(safeEntry);
      return safeEntry;
    }
  }

  async listRecent(limit = 50) {
    try {
      const [entries] = await this.logging.getEntries({
        filter: `logName="projects/${this.projectId}/logs/${LOG_NAME}"`,
        orderBy: 'timestamp desc',
        pageSize: Math.max(limit, 100),
      });
      this._markEmulatorVerified();
      const normalized = entries
        .map((e) => buildSafeLogEntry(e.data || {}))
        .filter((e) => e.operation && e.operation !== 'undefined');
      normalized.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
      return normalized.slice(0, limit);
    } catch (err) {
      // If orderBy isn't supported, retry without orderBy before falling back to disk
      try {
        const [entries] = await this.logging.getEntries({
          filter: `logName="projects/${this.projectId}/logs/${LOG_NAME}"`,
          pageSize: 500,
        });
        this._markEmulatorVerified();
        const normalized = entries
          .map((e) => buildSafeLogEntry(e.data || {}))
          .filter((e) => e.operation && e.operation !== 'undefined');
        normalized.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
        return normalized.slice(0, limit);
      } catch (innerErr) {
        this._markFallback(innerErr || err);
        const local = await this._readLocalLogs();
        return local.slice(0, limit);
      }
    }
  }

  getHealth() {
    return {
      mode: this.mode,
      status: this.status,
      sdk: '@google-cloud/logging',
      target: `${this.endpointHost}:${this.endpointPort}`,
      logName: `projects/${this.projectId}/logs/${LOG_NAME}`,
      ...(this.lastError ? { fallbackReason: this.lastError } : {}),
    };
  }
}
