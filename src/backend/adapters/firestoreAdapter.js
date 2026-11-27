import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Firestore } from '@google-cloud/firestore';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOCAL_DATA_DIR = path.resolve(__dirname, '../local-data');
const LOCAL_REQUESTS_FILE = path.join(LOCAL_DATA_DIR, 'requests.json');
const COLLECTION_NAME = 'serviceRequests';

/**
 * Firestore persistence adapter targeting the local Floci GCP emulator,
 * with automatic fallback to disk-backed JSON under src/backend/local-data/.
 */
export class FirestoreAdapter {
  constructor({ projectId, emulatorHost }) {
    this.projectId = projectId;
    this.emulatorHost = emulatorHost;
    this.mode = 'emulator';
    this.status = 'verified-emulator';
    this.lastError = null;

    process.env.GOOGLE_CLOUD_PROJECT = projectId;
    process.env.FIRESTORE_EMULATOR_HOST = emulatorHost;

    this.db = new Firestore({ projectId });
    this.collection = this.db.collection(COLLECTION_NAME);
  }

  async _ensureLocalDir() {
    await fs.mkdir(LOCAL_DATA_DIR, { recursive: true });
  }

  async _readLocalStore() {
    await this._ensureLocalDir();
    try {
      const raw = await fs.readFile(LOCAL_REQUESTS_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      if (err.code === 'ENOENT') return [];
      throw err;
    }
  }

  async _writeLocalStore(records) {
    await this._ensureLocalDir();
    await fs.writeFile(LOCAL_REQUESTS_FILE, JSON.stringify(records, null, 2), 'utf8');
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
      await this.collection.limit(1).get();
      this._markEmulatorVerified();
    } catch (err) {
      this._markFallback(err);
    }
    return this.getHealth();
  }

  async create(record) {
    try {
      await this.collection.doc(record.requestId).set(record);
      this._markEmulatorVerified();
      return record;
    } catch (err) {
      this._markFallback(err);
      const all = await this._readLocalStore();
      const idx = all.findIndex((r) => r.requestId === record.requestId);
      if (idx >= 0) {
        all[idx] = record;
      } else {
        all.push(record);
      }
      await this._writeLocalStore(all);
      return record;
    }
  }

  async getById(requestId) {
    try {
      const snap = await this.collection.doc(requestId).get();
      this._markEmulatorVerified();
      if (snap.exists) {
        return snap.data();
      }
      return null;
    } catch (err) {
      this._markFallback(err);
      const all = await this._readLocalStore();
      return all.find((r) => r.requestId === requestId) || null;
    }
  }

  async update(requestId, updatedRecord) {
    try {
      await this.collection.doc(requestId).set(updatedRecord);
      this._markEmulatorVerified();
      return updatedRecord;
    } catch (err) {
      this._markFallback(err);
      const all = await this._readLocalStore();
      const idx = all.findIndex((r) => r.requestId === requestId);
      if (idx >= 0) {
        all[idx] = updatedRecord;
      } else {
        all.push(updatedRecord);
      }
      await this._writeLocalStore(all);
      return updatedRecord;
    }
  }

  async listAll() {
    try {
      const snap = await this.collection.orderBy('createdAt', 'desc').get();
      this._markEmulatorVerified();
      return snap.docs.map((d) => d.data());
    } catch (err) {
      this._markFallback(err);
      const all = await this._readLocalStore();
      return [...all].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    }
  }

  async count() {
    const items = await this.listAll();
    return items.length;
  }

  getHealth() {
    return {
      mode: this.mode,
      status: this.status,
      sdk: '@google-cloud/firestore',
      target: this.emulatorHost,
      collection: COLLECTION_NAME,
      ...(this.lastError ? { fallbackReason: this.lastError } : {}),
    };
  }
}
