import crypto from 'node:crypto';
import express from 'express';
import cors from 'cors';
import { FirestoreAdapter } from './adapters/firestoreAdapter.js';
import { LoggingAdapter } from './adapters/loggingAdapter.js';
import { CloudRunAdapter } from './adapters/cloudRunAdapter.js';
import { FirestoreCollectionStore } from './adapters/collectionStore.js';
import {
  BOT_INTENTS,
  CAMPUS_DEPARTMENTS,
  LOCATIONS,
  POST_CATEGORIES,
  SECTORS,
  SECTOR_NAMES,
  SLA_HOURS,
  inferDepartment,
} from './campusData.js';
import {
  ALLOWED_TRANSITIONS,
  validateAnnouncement,
  validateCreateRequest,
  validatePost,
  validateStatusTransition,
  validateSyntheticAuth,
} from './validation.js';
import {
  buildSyntheticAnnouncements,
  buildSyntheticPosts,
  buildSyntheticSeedRequests,
} from './seed.js';

const PORT = Number(process.env.PORT || 4000);
const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT || 'floci-local';
const EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || 'localhost:4588';
const FLOCI_ENDPOINT = process.env.FLOCI_ENDPOINT || `http://${EMULATOR_HOST}`;

const [endpointHost, endpointPortStr] = EMULATOR_HOST.split(':');
const endpointPort = Number(endpointPortStr || 4588);

const firestore = new FirestoreAdapter({
  projectId: PROJECT_ID,
  emulatorHost: EMULATOR_HOST,
});

const announcementsStore = new FirestoreCollectionStore({
  projectId: PROJECT_ID,
  emulatorHost: EMULATOR_HOST,
  collectionName: 'announcements',
  localFileName: 'announcements.json',
});

const postsStore = new FirestoreCollectionStore({
  projectId: PROJECT_ID,
  emulatorHost: EMULATOR_HOST,
  collectionName: 'posts',
  localFileName: 'posts.json',
});

const profilesStore = new FirestoreCollectionStore({
  projectId: PROJECT_ID,
  emulatorHost: EMULATOR_HOST,
  collectionName: 'syntheticProfiles',
  localFileName: 'profiles.json',
});

const cloudLogging = new LoggingAdapter({
  projectId: PROJECT_ID,
  endpointHost,
  endpointPort,
});

const cloudRun = new CloudRunAdapter({
  projectId: PROJECT_ID,
  flociEndpoint: FLOCI_ENDPOINT,
  servicePort: PORT,
});

const app = express();
app.use(cors());
app.use(express.json({ limit: '64kb' }));

function latencyMsFrom(startNs) {
  return Number(process.hrtime.bigint() - startNs) / 1_000_000;
}

async function emitAuditLog({ startNs, requestId, operation, result, statusCode }) {
  try {
    await cloudLogging.write({
      timestamp: new Date().toISOString(),
      requestId: requestId || null,
      operation,
      result,
      statusCode,
      latencyMs: latencyMsFrom(startNs),
    });
  } catch {
    // Logging adapter handles local fallback internally; never block API responses.
  }
}

/* ============================================================================
 * CORE SERVICE REQUEST ENDPOINTS (100% T01–T08 backward-compatible)
 * ============================================================================ */

/**
 * POST /api/requests — Create a new service request (201 or 400).
 */
app.post('/api/requests', async (req, res) => {
  const startNs = process.hrtime.bigint();
  const validation = validateCreateRequest(req.body);

  if (!validation.valid) {
    await emitAuditLog({
      startNs,
      requestId: null,
      operation: 'INVALID_INPUT',
      result: 'VALIDATION_FAILED',
      statusCode: 400,
    });
    return res.status(400).json({
      error: 'Validation failed',
      details: validation.errors,
    });
  }

  const now = new Date().toISOString();
  const requestId = `REQ-${crypto.randomBytes(8).toString('hex')}`;
  const assignedDepartment = inferDepartment(
    validation.data.category,
    validation.data.location,
    validation.data.description,
  );

  const record = {
    requestId,
    category: validation.data.category,
    location: validation.data.location,
    description: validation.data.description,
    requesterRef: validation.data.requesterRef,
    assignedDepartment,
    status: 'Submitted',
    createdAt: now,
    updatedAt: now,
    statusHistory: [
      {
        fromStatus: null,
        toStatus: 'Submitted',
        changedBy: 'requester',
        timestamp: now,
      },
    ],
  };

  try {
    const saved = await firestore.create(record);
    await emitAuditLog({
      startNs,
      requestId,
      operation: 'CREATE_REQUEST',
      result: 'CREATED',
      statusCode: 201,
    });
    return res.status(201).json(saved);
  } catch {
    await emitAuditLog({
      startNs,
      requestId,
      operation: 'CREATE_REQUEST',
      result: 'INTERNAL_ERROR',
      statusCode: 500,
    });
    return res.status(500).json({ error: 'Failed to persist service request' });
  }
});

/**
 * GET /api/requests — List all service requests sorted newest-first (200).
 */
app.get('/api/requests', async (_req, res) => {
  const startNs = process.hrtime.bigint();
  try {
    const requests = await firestore.listAll();
    const enriched = requests.map((item) => ({
      ...item,
      assignedDepartment:
        item.assignedDepartment || inferDepartment(item.category, item.location, item.description),
    }));
    await emitAuditLog({
      startNs,
      requestId: null,
      operation: 'LIST_REQUESTS',
      result: `SUCCESS_COUNT_${enriched.length}`,
      statusCode: 200,
    });
    return res.status(200).json({
      count: enriched.length,
      requests: enriched,
    });
  } catch {
    await emitAuditLog({
      startNs,
      requestId: null,
      operation: 'LIST_REQUESTS',
      result: 'INTERNAL_ERROR',
      statusCode: 500,
    });
    return res.status(500).json({ error: 'Failed to list service requests' });
  }
});

/**
 * GET /api/requests/:id — Retrieve a single request by requestId (200 or 404).
 */
app.get('/api/requests/:id', async (req, res) => {
  const startNs = process.hrtime.bigint();
  const requestId = String(req.params.id || '').trim();

  try {
    const record = await firestore.getById(requestId);
    if (!record) {
      await emitAuditLog({
        startNs,
        requestId,
        operation: 'GET_REQUEST',
        result: 'NOT_FOUND',
        statusCode: 404,
      });
      return res.status(404).json({
        error: 'Service request not found',
        requestId,
      });
    }

    const enriched = {
      ...record,
      assignedDepartment:
        record.assignedDepartment || inferDepartment(record.category, record.location, record.description),
    };

    await emitAuditLog({
      startNs,
      requestId,
      operation: 'GET_REQUEST',
      result: 'FOUND',
      statusCode: 200,
    });
    return res.status(200).json(enriched);
  } catch {
    await emitAuditLog({
      startNs,
      requestId,
      operation: 'GET_REQUEST',
      result: 'INTERNAL_ERROR',
      statusCode: 500,
    });
    return res.status(500).json({ error: 'Failed to retrieve service request' });
  }
});

/**
 * PATCH /api/requests/:id/status — Transition request status strictly (200, 400, or 404).
 */
app.patch('/api/requests/:id/status', async (req, res) => {
  const startNs = process.hrtime.bigint();
  const requestId = String(req.params.id || '').trim();

  try {
    const existing = await firestore.getById(requestId);
    if (!existing) {
      await emitAuditLog({
        startNs,
        requestId,
        operation: 'UPDATE_STATUS',
        result: 'NOT_FOUND',
        statusCode: 404,
      });
      return res.status(404).json({
        error: 'Service request not found',
        requestId,
      });
    }

    const check = validateStatusTransition(existing.status, req.body);
    if (!check.valid) {
      await emitAuditLog({
        startNs,
        requestId,
        operation: check.type,
        result: check.type === 'INVALID_TRANSITION' ? 'TRANSITION_REJECTED' : 'VALIDATION_FAILED',
        statusCode: 400,
      });
      return res.status(400).json({
        error: check.error,
        requestId,
        currentStatus: existing.status,
        requestedStatus: check.requestedStatus || req.body?.status || null,
        allowedNextStates: ALLOWED_TRANSITIONS[existing.status] || [],
      });
    }

    const now = new Date().toISOString();
    const requestedDept =
      typeof req.body?.assignedDepartment === 'string' && SECTOR_NAMES.includes(req.body.assignedDepartment.trim())
        ? req.body.assignedDepartment.trim()
        : null;
    const assignedDepartment =
      requestedDept ||
      existing.assignedDepartment ||
      inferDepartment(existing.category, existing.location, existing.description);

    const updated = {
      ...existing,
      assignedDepartment,
      status: check.nextStatus,
      updatedAt: now,
      statusHistory: [
        ...(Array.isArray(existing.statusHistory) ? existing.statusHistory : []),
        {
          fromStatus: existing.status,
          toStatus: check.nextStatus,
          changedBy: check.changedBy,
          timestamp: now,
        },
      ],
    };

    const saved = await firestore.update(requestId, updated);
    await emitAuditLog({
      startNs,
      requestId,
      operation: 'UPDATE_STATUS',
      result: `TRANSITIONED_TO_${check.nextStatus.toUpperCase().replace(/\s+/g, '_')}`,
      statusCode: 200,
    });
    return res.status(200).json(saved);
  } catch {
    await emitAuditLog({
      startNs,
      requestId,
      operation: 'UPDATE_STATUS',
      result: 'INTERNAL_ERROR',
      statusCode: 500,
    });
    return res.status(500).json({ error: 'Failed to update request status' });
  }
});

/**
 * GET /api/logs — Return recent privacy-safe redacted structured logs (200).
 */
app.get('/api/logs', async (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit || 50), 1), 200);
  try {
    const logs = await cloudLogging.listRecent(limit);
    return res.status(200).json({
      count: logs.length,
      redactionPolicy: 'Strict whitelist: timestamp, requestId, operation, result, statusCode, latencyMs only',
      logs,
    });
  } catch {
    return res.status(500).json({ error: 'Failed to read structured logs' });
  }
});

/**
 * GET /api/health — Return Floci endpoint, active service modes, and total stored records.
 */
app.get('/api/health', async (_req, res) => {
  const [fsHealth, logHealth, runHealth, totalRequests] = await Promise.all([
    firestore.probe(),
    cloudLogging.probe(),
    cloudRun.verifyAndRegister(),
    firestore.count().catch(() => 0),
  ]);

  return res.status(200).json({
    status: 'ok',
    service: 'CampusServe API',
    projectId: PROJECT_ID,
    flociEndpoint: FLOCI_ENDPOINT,
    totalRequests,
    timestamp: new Date().toISOString(),
    services: {
      firestore: fsHealth,
      logging: logHealth,
      cloudRun: runHealth,
    },
  });
});

/* ============================================================================
 * SYNTHETIC DEMO AUTH ENDPOINTS (Never log login payloads)
 * ============================================================================ */

app.post('/api/auth/login', async (req, res) => {
  const check = validateSyntheticAuth(req.body, false);
  if (!check.valid) {
    return res.status(400).json({ error: check.error });
  }

  const stored = await profilesStore.getById(check.session.syntheticId).catch(() => null);
  const session = stored
    ? { ...check.session, department: stored.department || check.session.department, semester: stored.semester ?? check.session.semester }
    : check.session;

  return res.status(200).json({ session });
});

app.post('/api/auth/register', async (req, res) => {
  const check = validateSyntheticAuth(req.body, true);
  if (!check.valid) {
    return res.status(400).json({ error: check.error });
  }

  const profile = {
    id: check.session.syntheticId,
    ...check.session,
    createdAt: new Date().toISOString(),
  };
  await profilesStore.upsert(profile.id, profile);
  return res.status(201).json({ session: check.session });
});

/* ============================================================================
 * CAMPUSSERVE-SHARE EXTENDED MODULES
 * ============================================================================ */

/**
 * GET /api/locations — Campus buildings, rooms, labs, and service coverage.
 */
app.get('/api/locations', (req, res) => {
  const q = String(req.query.q || '').trim().toLowerCase();
  const building = String(req.query.building || '').trim();
  const floor = String(req.query.floor || '').trim();

  const filtered = LOCATIONS.filter((loc) => {
    const matchesQ =
      !q ||
      `${loc.building} ${loc.room} ${loc.name} ${loc.type} ${loc.note} ${loc.assignedDepartment}`
        .toLowerCase()
        .includes(q);
    const matchesBuilding = !building || loc.building === building;
    const matchesFloor = !floor || loc.floor === floor;
    return matchesQ && matchesBuilding && matchesFloor;
  });

  const buildings = [...new Set(LOCATIONS.map((l) => l.building))];

  return res.status(200).json({
    count: filtered.length,
    buildings,
    sectors: SECTORS,
    locations: filtered,
  });
});

/**
 * GET /api/analytics — Aggregated breakdown by status, category, location, and department.
 */
app.get('/api/analytics', async (_req, res) => {
  try {
    const [requests, posts] = await Promise.all([
      firestore.listAll(),
      postsStore.listAll('createdAt'),
    ]);

    const byStatus = { Submitted: 0, Assigned: 0, 'In progress': 0, Resolved: 0, Closed: 0 };
    const byCategory = {};
    const byDepartment = {};
    const byLocation = {};

    for (const sector of SECTOR_NAMES) {
      byDepartment[sector] = 0;
    }

    let resolvedOrClosed = 0;
    let overdueCount = 0;
    const slaCutoff = Date.now() - SLA_HOURS * 3600_000;

    for (const r of requests) {
      byStatus[r.status] = (byStatus[r.status] || 0) + 1;
      byCategory[r.category] = (byCategory[r.category] || 0) + 1;
      const dept = r.assignedDepartment || inferDepartment(r.category, r.location, r.description);
      byDepartment[dept] = (byDepartment[dept] || 0) + 1;
      const block = String(r.location || 'Unspecified').split('·')[0].split('-')[0].trim();
      byLocation[block] = (byLocation[block] || 0) + 1;

      if (r.status === 'Resolved' || r.status === 'Closed') {
        resolvedOrClosed += 1;
      } else if (new Date(r.createdAt).getTime() < slaCutoff) {
        overdueCount += 1;
      }
    }

    const total = requests.length;
    const resolutionRate = total > 0 ? Number(((resolvedOrClosed / total) * 100).toFixed(1)) : 0;
    const decisions = posts.filter((p) => p.kind === 'decision');

    return res.status(200).json({
      totalRequests: total,
      openRequests: (byStatus.Submitted || 0) + (byStatus.Assigned || 0),
      inProgressRequests: byStatus['In progress'] || 0,
      resolvedOrClosed,
      resolutionRate,
      overdueCount,
      slaHours: SLA_HOURS,
      byStatus,
      byCategory,
      byDepartment,
      byLocation,
      sectors: SECTORS,
      totalPosts: posts.filter((p) => p.kind !== 'decision').length,
      totalDecisions: decisions.length,
    });
  } catch {
    return res.status(500).json({ error: 'Failed to compute analytics' });
  }
});

/**
 * GET /api/audit — Redacted status-transition audit trail (no description or requesterRef).
 */
app.get('/api/audit', async (_req, res) => {
  try {
    const requests = await firestore.listAll();
    const entries = [];
    for (const r of requests) {
      const dept = r.assignedDepartment || inferDepartment(r.category, r.location, r.description);
      const history = Array.isArray(r.statusHistory) ? r.statusHistory : [];
      for (const h of history) {
        entries.push({
          requestId: r.requestId,
          category: r.category,
          assignedDepartment: dept,
          fromStatus: h.fromStatus ?? null,
          toStatus: h.toStatus,
          changedBy: h.changedBy || 'system',
          timestamp: h.timestamp,
        });
      }
    }
    entries.sort((a, b) => String(b.timestamp || '').localeCompare(String(a.timestamp || '')));
    return res.status(200).json({
      count: entries.length,
      entries,
    });
  } catch {
    return res.status(500).json({ error: 'Failed to build audit trail' });
  }
});

/**
 * GET /api/announcements & POST /api/announcements
 */
app.get('/api/announcements', async (_req, res) => {
  try {
    const announcements = await announcementsStore.listAll('createdAt');
    return res.status(200).json({ count: announcements.length, announcements });
  } catch {
    return res.status(500).json({ error: 'Failed to load announcements' });
  }
});

app.post('/api/announcements', async (req, res) => {
  const check = validateAnnouncement(req.body);
  if (!check.valid) {
    return res.status(400).json({ error: check.error });
  }
  const item = {
    id: `ANN-${crypto.randomBytes(4).toString('hex')}`,
    title: check.data.title,
    description: check.data.description,
    publishedBy: check.data.publishedBy,
    createdAt: new Date().toISOString(),
  };
  await announcementsStore.upsert(item.id, item);
  return res.status(201).json(item);
});

/**
 * GET /api/posts, POST /api/posts, POST /api/posts/:id/vote
 * Handles both community posts and administrative decisions.
 */
app.get('/api/posts', async (req, res) => {
  try {
    const kindFilter = req.query.kind ? String(req.query.kind) : null;
    const all = await postsStore.listAll('createdAt');
    const items = kindFilter ? all.filter((p) => (p.kind || 'post') === kindFilter) : all;
    return res.status(200).json({
      count: items.length,
      categories: POST_CATEGORIES,
      posts: items,
    });
  } catch {
    return res.status(500).json({ error: 'Failed to load posts' });
  }
});

app.post('/api/posts', async (req, res) => {
  const check = validatePost(req.body);
  if (!check.valid) {
    return res.status(400).json({ error: check.error });
  }

  const now = new Date().toISOString();
  const isDecision = check.data.kind === 'decision';
  const idPrefix = isDecision ? 'DEC' : 'POST';
  const item = {
    id: `${idPrefix}-${crypto.randomBytes(4).toString('hex')}`,
    kind: check.data.kind,
    title: check.data.title,
    body: check.data.body,
    category: check.data.category,
    authorRef: check.data.authorRef,
    authorLabel: check.data.authorLabel,
    authorRole: check.data.authorRole,
    isPinned: false,
    upvotes: 0,
    voterRefs: [],
    reactions: {},
    ...(isDecision
      ? {
          status: 'Active',
          aiSummary: check.data.aiSummary || check.data.body.slice(0, 180),
          opensAt: now,
          closesAt: new Date(Date.now() + 7 * 86_400_000).toISOString(),
          options: (check.data.options && check.data.options.length >= 2
            ? check.data.options
            : ['Approve proposal', 'Request revision', 'Defer']
          ).map((lbl, i) => ({
            id: `opt-${i + 1}`,
            label: typeof lbl === 'string' ? lbl : lbl.label,
            votes: 0,
          })),
          voterHashes: [],
        }
      : {}),
    createdAt: now,
  };

  await postsStore.upsert(item.id, item);
  return res.status(201).json(item);
});

app.post('/api/posts/:id/vote', async (req, res) => {
  const id = String(req.params.id || '').trim();
  const item = await postsStore.getById(id);
  if (!item) {
    return res.status(404).json({ error: 'Post or decision not found', id });
  }

  const voterRef = typeof req.body?.voterRef === 'string' && req.body.voterRef.trim()
    ? req.body.voterRef.trim().toUpperCase()
    : 'STU-1042';

  // Decision anonymous option ballot
  if (item.kind === 'decision' && req.body?.optionId) {
    if (item.status !== 'Active') {
      return res.status(400).json({ error: `Decision is "${item.status}" and is not open for voting.` });
    }
    const voterHash = crypto
      .createHash('sha256')
      .update(`${voterRef}:${item.id}`)
      .digest('hex');

    const hashes = Array.isArray(item.voterHashes) ? item.voterHashes : [];
    if (hashes.includes(voterHash)) {
      return res.status(400).json({ error: 'This synthetic session has already cast a ballot on this proposal.' });
    }

    const optIdx = (item.options || []).findIndex((o) => o.id === req.body.optionId);
    if (optIdx === -1) {
      return res.status(400).json({ error: 'Invalid decision optionId.' });
    }

    const updatedOptions = item.options.map((o, idx) =>
      idx === optIdx ? { ...o, votes: (o.votes || 0) + 1 } : o,
    );
    const receipt = voterHash.slice(0, 12).toUpperCase();
    const updated = {
      ...item,
      options: updatedOptions,
      voterHashes: [...hashes, voterHash],
      upvotes: (item.upvotes || 0) + 1,
    };
    await postsStore.upsert(id, updated);
    return res.status(200).json({ post: updated, receipt });
  }

  // Emoji reaction toggle on community post
  if (req.body?.emoji) {
    const emoji = String(req.body.emoji).slice(0, 8);
    const reactions = { ...(item.reactions || {}) };
    reactions[emoji] = (reactions[emoji] || 0) + 1;
    const updated = { ...item, reactions };
    await postsStore.upsert(id, updated);
    return res.status(200).json({ post: updated });
  }

  // Standard community post upvote toggle
  const voterRefs = Array.isArray(item.voterRefs) ? item.voterRefs : [];
  const hasVoted = voterRefs.includes(voterRef);
  const nextRefs = hasVoted ? voterRefs.filter((v) => v !== voterRef) : [...voterRefs, voterRef];
  const nextVotes = Math.max(0, (item.upvotes || 0) + (hasVoted ? -1 : 1));

  const updated = {
    ...item,
    voterRefs: nextRefs,
    upvotes: nextVotes,
  };
  await postsStore.upsert(id, updated);
  return res.status(200).json({ post: updated, voted: !hasVoted });
});

/**
 * GET /api/notifications — Status-change alerts and recent announcements for synthetic sessions.
 */
app.get('/api/notifications', async (req, res) => {
  try {
    const ref = req.query.ref ? String(req.query.ref).trim().toUpperCase() : null;
    const [requests, announcements] = await Promise.all([
      firestore.listAll(),
      announcementsStore.listAll('createdAt'),
    ]);

    const alerts = [];
    for (const r of requests) {
      if (ref && ref.startsWith('STU-') && r.requesterRef !== ref) continue;
      const history = Array.isArray(r.statusHistory) ? r.statusHistory : [];
      const latest = history[history.length - 1];
      alerts.push({
        id: `NOTIF-${r.requestId}`,
        type: 'status',
        requestId: r.requestId,
        title: `Ticket ${r.requestId} is ${r.status}`,
        message: `${r.category} at ${r.location} (${r.assignedDepartment || 'IT Services'}) — ${
          latest?.fromStatus ? `${latest.fromStatus} → ${latest.toStatus}` : 'Submitted'
        }.`,
        timestamp: r.updatedAt || r.createdAt,
      });
    }

    for (const a of announcements.slice(0, 3)) {
      alerts.push({
        id: `NOTIF-${a.id}`,
        type: 'announcement',
        title: `Notice: ${a.title}`,
        message: a.description,
        timestamp: a.createdAt,
      });
    }

    alerts.sort((a, b) => String(b.timestamp || '').localeCompare(String(a.timestamp || '')));
    return res.status(200).json({
      count: alerts.length,
      notifications: alerts.slice(0, 25),
    });
  } catch {
    return res.status(500).json({ error: 'Failed to load notifications' });
  }
});

/**
 * POST /api/campusbot — Rule-based assistant for ticket lookup, routing, and lifecycle guidance.
 */
app.post('/api/campusbot', async (req, res) => {
  const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
  if (!message) {
    return res.status(400).json({ error: 'message is required.' });
  }

  // 1. Check if the user pasted a REQ-... tracking ID
  const idMatch = message.match(/REQ-[a-f0-9]{16}/i);
  if (idMatch) {
    const targetId = idMatch[0];
    const record = await firestore.getById(targetId).catch(() => null);
    if (!record) {
      return res.status(200).json({
        reply: `I checked Firestore for ${targetId}, but no ticket matched (HTTP 404). Verify the 16-hex suffix and try again.`,
        ticket: null,
        intents: BOT_INTENTS.map((i) => i.tag),
      });
    }
    const allowed = ALLOWED_TRANSITIONS[record.status] || [];
    const dept = record.assignedDepartment || inferDepartment(record.category, record.location, record.description);
    return res.status(200).json({
      reply: `Ticket ${record.requestId} is currently "${record.status}" under ${record.category} (${record.location}), assigned to ${dept}. Allowed next states: ${
        allowed.length ? allowed.join(', ') : 'None (terminal Closed state)'
      }.`,
      ticket: {
        requestId: record.requestId,
        status: record.status,
        category: record.category,
        location: record.location,
        assignedDepartment: dept,
        allowedNextStates: allowed,
      },
      intents: BOT_INTENTS.map((i) => i.tag),
    });
  }

  const lower = message.toLowerCase();

  // 2. Check if user mentions a campus room/block from LOCATIONS
  const locMatch = LOCATIONS.find(
    (l) => lower.includes(l.room.toLowerCase()) || lower.includes(l.name.toLowerCase()),
  );
  if (locMatch && (lower.includes('where') || lower.includes('room') || lower.includes('lab') || lower.includes('find'))) {
    return res.status(200).json({
      reply: `${locMatch.room} (${locMatch.name}) is in ${locMatch.building}, Floor ${locMatch.floor} — ${locMatch.note}. Support team: ${locMatch.assignedDepartment}.`,
      suggestedLocation: `${locMatch.building} · ${locMatch.room} ${locMatch.name}`,
      suggestedDepartment: locMatch.assignedDepartment,
      intents: BOT_INTENTS.map((i) => i.tag),
    });
  }

  // 3. Match BOT_INTENTS by longest keyword overlap
  let bestIntent = null;
  let bestScore = 0;
  for (const intent of BOT_INTENTS) {
    let score = 0;
    for (const pattern of intent.patterns) {
      if (lower.includes(pattern)) {
        score += pattern.length;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestIntent = intent;
    }
  }

  // 4. Also suggest category & department if the user describes a problem
  const suggestedDept = inferDepartment('IT Support', message);
  const suggestedCategory =
    lower.includes('wifi') || lower.includes('network') || lower.includes('projector') || lower.includes('software') || lower.includes('computer')
      ? 'IT Support'
      : lower.includes('water') || lower.includes('power') || lower.includes('clean') || lower.includes('hostel') || lower.includes('library')
      ? 'Facilities'
      : 'Classroom Maintenance';

  if (bestIntent) {
    return res.status(200).json({
      reply: bestIntent.reply,
      suggestedCategory,
      suggestedDepartment: suggestedDept,
      intents: BOT_INTENTS.map((i) => i.tag),
    });
  }

  return res.status(200).json({
    reply: `For that issue, I recommend submitting under "${suggestedCategory}" (auto-routed to ${suggestedDept}). You can also paste any REQ-... ticket ID here for an instant status lookup.`,
    suggestedCategory,
    suggestedDepartment: suggestedDept,
    intents: BOT_INTENTS.map((i) => i.tag),
  });
});

/**
 * POST /api/seed — Populate 4 synthetic BMSCE requests + announcements + posts/decisions.
 */
app.post('/api/seed', async (_req, res) => {
  const startNs = process.hrtime.bigint();
  const seeds = buildSyntheticSeedRequests();
  let seededCount = 0;

  for (const item of seeds) {
    const existing = await firestore.getById(item.requestId);
    if (!existing) {
      await firestore.create(item);
      seededCount += 1;
      await emitAuditLog({
        startNs,
        requestId: item.requestId,
        operation: 'CREATE_REQUEST',
        result: 'SEEDED_SYNTHETIC_DEMO',
        statusCode: 201,
      });
    }
  }

  const seedAnnouncements = buildSyntheticAnnouncements();
  let seededAnnouncements = 0;
  for (const ann of seedAnnouncements) {
    const existing = await announcementsStore.getById(ann.id);
    if (!existing) {
      await announcementsStore.upsert(ann.id, ann);
      seededAnnouncements += 1;
    }
  }

  const seedPosts = buildSyntheticPosts();
  let seededPosts = 0;
  for (const post of seedPosts) {
    const existing = await postsStore.getById(post.id);
    if (!existing) {
      await postsStore.upsert(post.id, post);
      seededPosts += 1;
    }
  }

  const all = await firestore.listAll();
  return res.status(200).json({
    seeded: seededCount,
    seededAnnouncements,
    seededPosts,
    totalRequests: all.length,
    requests: all,
  });
});

// Handle malformed JSON payloads safely with 400
app.use((err, _req, res, _next) => {
  if (err && err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Malformed JSON request body' });
  }
  return res.status(500).json({ error: 'Unexpected server error' });
});

async function start() {
  const [fsHealth, logHealth, runHealth] = await Promise.all([
    firestore.probe(),
    cloudLogging.probe(),
    cloudRun.verifyAndRegister(),
  ]);

  app.listen(PORT, () => {
    console.log(`[CampusServe API] Listening on http://localhost:${PORT}`);
    console.log(`[CampusServe API] Floci Endpoint: ${FLOCI_ENDPOINT} (Project: ${PROJECT_ID})`);
    console.log(`[CampusServe API] Firestore: ${fsHealth.status} | Logging: ${logHealth.status} | Cloud Run: ${runHealth.status}`);
  });
}

start();

export { CAMPUS_DEPARTMENTS };
