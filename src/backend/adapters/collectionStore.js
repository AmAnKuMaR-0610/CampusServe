import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Firestore } from '@google-cloud/firestore';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOCAL_DATA_DIR = path.resolve(__dirname, '../local-data');

/**
 * Generic Firestore-backed collection store using @google-cloud/firestore
 * on Floci emulator with labeled disk fallback under src/backend/local-data/.
 */
export class FirestoreCollectionStore {
  constructor({ projectId, emulatorHost, collectionName, localFileName }) {
    this.projectId = projectId;
    this.emulatorHost = emulatorHost;
    this.collectionName = collectionName;
    this.localFilePath = path.join(LOCAL_DATA_DIR, localFileName);
    this.mode = 'emulator';
    this.status = 'verified-emulator';
    this.lastError = null;

    process.env.GOOGLE_CLOUD_PROJECT = projectId;
    process.env.FIRESTORE_EMULATOR_HOST = emulatorHost;
    this.db = new Firestore({ projectId });
    this.collection = this.db.collection(collectionName);
  }

  async _readLocal() {
    await fs.mkdir(LOCAL_DATA_DIR, { recursive: true });
    try {
      const raw = await fs.readFile(this.localFilePath, 'utf8');
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      if (err.code === 'ENOENT') return [];
      throw err;
    }
  }

  async _writeLocal(items) {
    await fs.mkdir(LOCAL_DATA_DIR, { recursive: true });
    await fs.writeFile(this.localFilePath, JSON.stringify(items, null, 2), 'utf8');
  }

  _markFallback(err) {
    this.mode = 'adapter';
    this.status = 'labeled-local-adapter';
    this.lastError = err?.message || String(err);
  }

  _markEmulator() {
    this.mode = 'emulator';
    this.status = 'verified-emulator';
    this.lastError = null;
  }

  async upsert(id, doc) {
    try {
      await this.collection.doc(String(id)).set(doc);
      this._markEmulator();
      return doc;
    } catch (err) {
      this._markFallback(err);
      const all = await this._readLocal();
      const idx = all.findIndex((item) => item.id === id);
      if (idx >= 0) all[idx] = doc;
      else all.push(doc);
      await this._writeLocal(all);
      return doc;
    }
  }

  async getById(id) {
    try {
      const snap = await this.collection.doc(String(id)).get();
      this._markEmulator();
      return snap.exists ? snap.data() : null;
    } catch (err) {
      this._markFallback(err);
      const all = await this._readLocal();
      return all.find((item) => item.id === id) || null;
    }
  }

  async listAll(sortField = 'createdAt') {
    try {
      const snap = await this.collection.orderBy(sortField, 'desc').get();
      this._markEmulator();
      return snap.docs.map((d) => d.data());
    } catch (err) {
      try {
        // Retry unordered Firestore get if orderBy fails on missing index/field
        const snap = await this.collection.get();
        this._markEmulator();
        return snap.docs
          .map((d) => d.data())
          .sort((a, b) => String(b[sortField] || '').localeCompare(String(a[sortField] || '')));
      } catch (innerErr) {
        this._markFallback(innerErr || err);
        const all = await this._readLocal();
        return [...all].sort((a, b) => String(b[sortField] || '').localeCompare(String(a[sortField] || '')));
      }
    }
  }
}
