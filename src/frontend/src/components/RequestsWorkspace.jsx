import { useEffect, useState } from 'react';
import {
  CATEGORIES,
  INVALID_JUMP_TARGET,
  VALID_ACTIONS,
  formatTimestamp,
} from '../constants.js';
import { SectorChip, StatusBadge } from './StatusBadge.jsx';
import { ErrorStateCard } from './ErrorViews.jsx';

const STEPPER_STAGES = ['Submitted', 'Assigned', 'In progress', 'Resolved / Closed'];
const FILTER_STATUSES = ['All', 'Submitted', 'Assigned', 'In progress', 'Resolved', 'Closed'];

function getStepIndex(status) {
  if (status === 'Submitted') return 0;
  if (status === 'Assigned') return 1;
  if (status === 'In progress') return 2;
  if (status === 'Resolved' || status === 'Closed') return 3;
  return 0;
}

export function RequestsWorkspace({
  session,
  requests,
  locations,
  initialSubTab = 'submit',
  initialTrackId = '',
  initialLocation = '',
  onRefreshAll,
}) {
  const [subTab, setSubTab] = useState(initialSubTab);

  // Submit state
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [location, setLocation] = useState(initialLocation || '');
  const [description, setDescription] = useState('');
  const [requesterRef, setRequesterRef] = useState(
    session?.syntheticId?.startsWith('STU-') ? session.syntheticId : 'STU-1042',
  );
  const [submitting, setSubmitting] = useState(false);
  const [submitErrors, setSubmitErrors] = useState([]);
  const [createdRecord, setCreatedRecord] = useState(null);
  const [copied, setCopied] = useState(false);

  // Track state
  const [queryId, setQueryId] = useState(initialTrackId || '');
  const [trackLoading, setTrackLoading] = useState(false);
  const [trackedRecord, setTrackedRecord] = useState(null);
  const [notFoundId, setNotFoundId] = useState('');
  const [trackErr, setTrackErr] = useState('');

  // Status console state
  const [statusFilter, setStatusFilter] = useState('All');
  const [consoleSearch, setConsoleSearch] = useState('');
  const [busyId, setBusyId] = useState('');
  const [consoleFeedback, setConsoleFeedback] = useState(null);

  useEffect(() => {
    if (initialLocation) {
      setLocation(initialLocation);
      setSubTab('submit');
    }
  }, [initialLocation]);

  async function lookupById(targetId) {
    const cleanId = String(targetId || '').trim();
    if (!cleanId) return;
    setQueryId(cleanId);
    setTrackLoading(true);
    setNotFoundId('');
    setTrackErr('');
    try {
      const res = await fetch(`/api/requests/${encodeURIComponent(cleanId)}`);
      const data = await res.json();
      if (res.status === 404) {
        setTrackedRecord(null);
        setNotFoundId(cleanId);
        return;
      }
      if (!res.ok) {
        setTrackedRecord(null);
        setTrackErr(data.error || 'Failed to look up request');
        return;
      }
      setTrackedRecord(data);
    } catch {
      setTrackErr('Unable to reach backend API on port 4000.');
    } finally {
      setTrackLoading(false);
    }
  }

  useEffect(() => {
    if (initialTrackId) {
      setSubTab('track');
      lookupById(initialTrackId);
    }
  }, [initialTrackId]);

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitErrors([]);
    setSubmitting(true);
    try {
      const res = await fetch('/api/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, location, description, requesterRef }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSubmitErrors(Array.isArray(data.details) ? data.details : [data.error || 'Validation failed']);
        return;
      }
      setCreatedRecord(data);
      setLocation('');
      setDescription('');
      await onRefreshAll();
    } catch {
      setSubmitErrors(['Network error while reaching backend API on port 4000.']);
    } finally {
      setSubmitting(false);
    }
  }

  function handleAiAssistPolish() {
    const val = description.trim();
    if (val.length < 8) return;
    let polished = val.charAt(0).toUpperCase() + val.slice(1);
    if (!/[.!?]$/.test(polished)) polished += '.';
    if (location && !polished.toLowerCase().includes(location.toLowerCase())) {
      polished += ` Location: ${location}.`;
    }
    setDescription(polished.slice(0, 500));
  }

  async function handleCopyId() {
    if (!createdRecord?.requestId) return;
    try {
      await navigator.clipboard.writeText(createdRecord.requestId);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard unavailable
    }
  }

  async function triggerTransition(requestId, nextStatus, isIntentionalInvalid = false) {
    setBusyId(requestId);
    setConsoleFeedback(null);
    try {
      const res = await fetch(`/api/requests/${encodeURIComponent(requestId)}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: nextStatus,
          changedBy: isIntentionalInvalid
            ? 'invalid-jump-test'
            : `${session?.syntheticId || 'service-desk'}`,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setConsoleFeedback({
          kind: 'rejected',
          title: `HTTP ${res.status} Rejected — State Guardrail Enforced`,
          message: `${data.error} Allowed next states: ${
            data.allowedNextStates?.length ? data.allowedNextStates.join(', ') : 'None (terminal Closed)'
          }.`,
        });
        return;
      }
      setConsoleFeedback({
        kind: 'success',
        title: `Transitioned to "${data.status}"`,
        message: `${requestId} updated cleanly (${data.assignedDepartment}) and persisted.`,
      });
      if (trackedRecord?.requestId === requestId) {
        setTrackedRecord(data);
      }
      await onRefreshAll();
    } catch {
      setConsoleFeedback({
        kind: 'rejected',
        title: 'Network Error',
        message: 'Could not reach backend API on port 4000.',
      });
    } finally {
      setBusyId('');
    }
  }

  const filteredRequests = requests.filter((r) => {
    const matchesStatus = statusFilter === 'All' || r.status === statusFilter;
    const term = consoleSearch.trim().toLowerCase();
    const matchesTerm =
      !term ||
      r.requestId.toLowerCase().includes(term) ||
      r.location.toLowerCase().includes(term) ||
      r.category.toLowerCase().includes(term) ||
      (r.assignedDepartment || '').toLowerCase().includes(term) ||
      r.requesterRef.toLowerCase().includes(term);
    return matchesStatus && matchesTerm;
  });

  const activeStep = trackedRecord ? getStepIndex(trackedRecord.status) : -1;

  return (
    <div className="space-y-5">
      <section className="page-head">
        <div>
          <div className="eyebrow">Report → Track → Transition</div>
          <h1 className="page-title">Service Requests &amp; Status Console</h1>
          <p className="page-sub">
            Submit campus issues with auto-department routing, track any <code className="font-mono">REQ-</code> ID, and enforce valid lifecycle transitions.
          </p>
        </div>

        <div className="flex gap-2 flex-wrap">
          {[
            { id: 'submit', label: 'Submit Request', icon: 'bi-plus-circle' },
            { id: 'track', label: 'Track Request', icon: 'bi-search' },
            { id: 'console', label: 'Status Console', icon: 'bi-sliders' },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setSubTab(t.id)}
              className={`btn-cs btn-cs-sm ${subTab === t.id ? 'btn-cs-primary' : 'btn-cs-ghost'}`}
            >
              <i className={`bi ${t.icon}`} />
              {t.label}
            </button>
          ))}
        </div>
      </section>

      {/* SUB-TAB 1: SUBMIT REQUEST */}
      {subTab === 'submit' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          <div className="lg:col-span-7 glass-card p-6">
            <div className="flex items-center justify-between gap-2 mb-4 pb-3 border-b cs-border">
              <div>
                <h2 className="text-base font-bold">Submit Service Request</h2>
                <p className="text-xs cs-muted">
                  Initialized strictly to <span className="font-semibold">Submitted</span> and auto-routed to the owning BMSCE sector.
                </p>
              </div>
              <span className="badge-status badge-upcoming">
                <i className="bi bi-stars" />
                Auto-routed
              </span>
            </div>

            {submitErrors.length > 0 && (
              <div className="mb-4 rounded-xl border border-rose-400/40 bg-rose-500/15 p-3.5 text-xs text-rose-200">
                <div className="font-bold flex items-center gap-1.5 mb-1">
                  <i className="bi bi-exclamation-octagon-fill text-rose-400" />
                  Validation Error (HTTP 400)
                </div>
                <ul className="list-disc list-inside space-y-0.5">
                  {submitErrors.map((err, i) => <li key={i}>{err}</li>)}
                </ul>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold cs-secondary mb-1.5">Category</label>
                <select value={category} onChange={(e) => setCategory(e.target.value)} className="cs-select">
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold cs-secondary mb-1.5">
                    Room / Location <span className="cs-muted font-normal">(3–80 chars)</span>
                  </label>
                  <input
                    list="bmsce-locations-list"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="e.g., Main Block (A) · A-303 CSE Lab 2"
                    className="cs-input"
                  />
                  <datalist id="bmsce-locations-list">
                    {locations.map((l) => (
                      <option key={l.room} value={`${l.building} · ${l.room} ${l.name}`} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <label className="block text-xs font-semibold cs-secondary mb-1.5">
                    Synthetic Student Ref <span className="cs-muted font-normal">(STU-XXX)</span>
                  </label>
                  <input
                    value={requesterRef}
                    onChange={(e) => setRequesterRef(e.target.value)}
                    placeholder="STU-1042"
                    className="cs-input font-mono"
                  />
                </div>
              </div>

              <div className="rounded-xl border cs-border bg-[rgba(122,170,255,0.06)] px-3.5 py-2.5 text-xs cs-secondary flex items-start gap-2">
                <i className="bi bi-shield-check cs-brand mt-0.5" />
                <span>
                  <strong>Privacy Guardrail:</strong> Use synthetic IDs only (<code className="font-mono">STU-1042</code>). Real names/emails are rejected and descriptions are stripped from Cloud Logging.
                </span>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold cs-secondary">
                    Issue Description <span className="cs-muted font-normal">(10–500 chars)</span>
                  </label>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={handleAiAssistPolish}
                      className="btn-cs btn-cs-ghost btn-cs-sm"
                    >
                      <i className="bi bi-stars" />
                      Polish draft
                    </button>
                    <span
                      className={`text-xs font-mono ${
                        description.trim().length >= 10 && description.trim().length <= 500
                          ? 'text-emerald-400 font-semibold'
                          : 'cs-muted'
                      }`}
                    >
                      {description.length} / 500
                    </span>
                  </div>
                </div>
                <textarea
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe what happened, room details, and impact..."
                  className="cs-textarea"
                />
              </div>

              <div className="flex justify-end">
                <button type="submit" disabled={submitting} className="btn-cs btn-cs-primary">
                  <i className="bi bi-send" />
                  {submitting ? 'Submitting...' : 'Submit Service Request'}
                </button>
              </div>
            </form>
          </div>

          <div className="lg:col-span-5">
            {createdRecord ? (
              <div className="glass-card p-6 space-y-4 border-emerald-400/40">
                <div className="flex items-center justify-between">
                  <span className="badge-status badge-resolved">
                    <i className="bi bi-check-circle" />
                    HTTP 201 Created
                  </span>
                  <StatusBadge status={createdRecord.status} />
                </div>

                <div className="rounded-2xl p-4 border cs-border bg-[rgba(122,170,255,0.06)]">
                  <div className="text-[11px] uppercase tracking-wider cs-muted mb-1">
                    Non-Guessable Request ID
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <code className="text-base font-bold font-mono cs-brand break-all">
                      {createdRecord.requestId}
                    </code>
                    <button type="button" onClick={handleCopyId} className="btn-cs btn-cs-secondary btn-cs-sm">
                      <i className={`bi ${copied ? 'bi-check2' : 'bi-clipboard'}`} />
                      {copied ? 'Copied' : 'Copy ID'}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5 text-xs">
                  <div className="p-3 rounded-xl border cs-border">
                    <div className="cs-muted">Category</div>
                    <div className="font-semibold mt-0.5">{createdRecord.category}</div>
                  </div>
                  <div className="p-3 rounded-xl border cs-border">
                    <div className="cs-muted">Auto-Routed Sector</div>
                    <div className="mt-1"><SectorChip department={createdRecord.assignedDepartment} /></div>
                  </div>
                  <div className="col-span-2 p-3 rounded-xl border cs-border">
                    <div className="cs-muted">Location</div>
                    <div className="font-semibold mt-0.5">{createdRecord.location}</div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setSubTab('track');
                    lookupById(createdRecord.requestId);
                  }}
                  className="btn-cs btn-cs-primary w-full"
                >
                  Track Request →
                </button>
              </div>
            ) : (
              <div className="glass-card p-6 space-y-3">
                <h3 className="text-base font-bold">Submission Guardrails</h3>
                <p className="text-xs cs-secondary leading-relaxed">
                  Every ticket is strictly schema-validated and persisted to Floci Firestore with an immutable audit history.
                </p>
                <ul className="space-y-2 text-xs cs-secondary">
                  <li><i className="bi bi-key cs-brand mr-2" />64-bit random ID (<code className="font-mono">REQ-&lt;16 hex&gt;</code>)</li>
                  <li><i className="bi bi-diagram-3 cs-brand mr-2" />Automatic keyword routing across 9 sectors</li>
                  <li><i className="bi bi-lock cs-brand mr-2" />Zero-PII structured Cloud Logging</li>
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUB-TAB 2: TRACK REQUEST */}
      {subTab === 'track' && (
        <div className="space-y-5">
          <div className="glass-card p-6">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <div>
                <h2 className="text-base font-bold">Track Request by ID</h2>
                <p className="text-xs cs-muted">Look up live lifecycle stage, assigned sector, and audit history.</p>
              </div>
              <button
                type="button"
                onClick={() => lookupById('REQ-0000000000000000')}
                className="btn-cs btn-cs-danger btn-cs-sm"
              >
                Test Unknown ID (404)
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                lookupById(queryId);
              }}
              className="flex flex-col sm:flex-row gap-3"
            >
              <input
                value={queryId}
                onChange={(e) => setQueryId(e.target.value)}
                placeholder="Enter Request ID (e.g., REQ-b5ce1042a0000001)"
                className="cs-input font-mono flex-1"
              />
              <button type="submit" disabled={trackLoading || !queryId.trim()} className="btn-cs btn-cs-primary">
                <i className="bi bi-search" />
                {trackLoading ? 'Searching...' : 'Track ID'}
              </button>
            </form>

            {requests.length > 0 && (
              <div className="mt-4 pt-4 border-t cs-border">
                <div className="text-[11px] uppercase tracking-wider cs-muted font-semibold mb-2">
                  Recent Request IDs (Click to inspect)
                </div>
                <div className="flex flex-wrap gap-2">
                  {requests.slice(0, 6).map((r) => (
                    <button
                      key={r.requestId}
                      type="button"
                      onClick={() => lookupById(r.requestId)}
                      className={`inline-flex items-center gap-2 px-2.5 py-1.5 rounded-xl border text-xs font-mono cursor-pointer transition-all ${
                        trackedRecord?.requestId === r.requestId
                          ? 'border-[var(--brand)] bg-[var(--brand-soft)]'
                          : 'cs-border bg-[rgba(122,170,255,0.05)] hover:border-[var(--glass-border-strong)]'
                      }`}
                    >
                      <span>{r.requestId}</span>
                      <StatusBadge status={r.status} />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {notFoundId && (
            <ErrorStateCard
              code={404}
              title={`Request ${notFoundId} not found`}
              message="No service request matched that tracking ID in Floci Firestore (controlled HTTP 404)."
              onBrowseRequests={() => setSubTab('console')}
            />
          )}

          {trackErr && (
            <ErrorStateCard code={500} title="Lookup failed" message={trackErr} />
          )}

          {trackedRecord && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              <div className="lg:col-span-8 space-y-5">
                <div className="glass-card p-6 space-y-5">
                  <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b cs-border">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="ticket-id">{trackedRecord.requestId}</span>
                        <StatusBadge status={trackedRecord.status} />
                        <SectorChip department={trackedRecord.assignedDepartment} />
                      </div>
                      <h3 className="text-lg font-bold">{trackedRecord.location}</h3>
                    </div>
                    <span className="text-xs font-mono cs-muted">{formatTimestamp(trackedRecord.updatedAt)}</span>
                  </div>

                  {/* 4-Step Visual Progress Stepper */}
                  <div className="grid grid-cols-4 gap-2 py-2">
                    {STEPPER_STAGES.map((stage, idx) => {
                      const done = idx < activeStep || (idx === 3 && activeStep === 3);
                      const current = idx === activeStep;
                      const label =
                        idx === 3 && (trackedRecord.status === 'Resolved' || trackedRecord.status === 'Closed')
                          ? trackedRecord.status
                          : stage;
                      return (
                        <div key={stage} className="flex flex-col items-center text-center">
                          <div
                            className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold border-2 ${
                              done
                                ? 'bg-emerald-500 border-emerald-400 text-slate-950'
                                : current
                                ? 'bg-[var(--brand)] border-[var(--brand-2)] text-slate-950'
                                : 'border-[var(--glass-border-strong)] cs-muted'
                            }`}
                          >
                            {done ? <i className="bi bi-check-lg text-sm" /> : idx + 1}
                          </div>
                          <span className={`mt-2 text-xs font-semibold ${done || current ? 'cs-txt' : 'cs-muted'}`}>
                            {label}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  <div className="p-4 rounded-2xl border cs-border bg-[rgba(122,170,255,0.05)]">
                    <div className="text-[11px] uppercase tracking-wider cs-muted mb-1">Description</div>
                    <p className="text-sm cs-secondary leading-relaxed">{trackedRecord.description}</p>
                  </div>
                </div>

                {/* Status History Timeline */}
                <div className="glass-card p-6">
                  <h4 className="text-base font-bold mb-4">
                    <i className="bi bi-clock-history cs-brand mr-2" />
                    Status History Audit Timeline
                  </h4>
                  <div className="timeline-cs">
                    {(trackedRecord.statusHistory || []).map((h, idx, arr) => (
                      <div key={`${h.timestamp}-${idx}`} className={`timeline-item-cs ${idx === arr.length - 1 ? 'is-current' : ''}`}>
                        <div className="text-[11px] font-mono cs-muted">{formatTimestamp(h.timestamp)}</div>
                        <div className="text-sm font-semibold mt-0.5 flex items-center gap-2 flex-wrap">
                          {h.fromStatus ? (
                            <>
                              <span>{h.fromStatus}</span>
                              <i className="bi bi-arrow-right text-xs cs-muted" />
                            </>
                          ) : (
                            <span className="text-xs cs-muted">Initial →</span>
                          )}
                          <StatusBadge status={h.toStatus} />
                          <span className="text-xs cs-muted font-normal">· {h.changedBy}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="lg:col-span-4 glass-card p-5 space-y-3 h-fit">
                <h4 className="text-base font-bold">Ticket Metadata</h4>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1.5 border-b cs-border">
                    <span className="cs-muted">Category</span>
                    <span className="font-semibold">{trackedRecord.category}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b cs-border">
                    <span className="cs-muted">Department</span>
                    <span className="font-semibold">{trackedRecord.assignedDepartment}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b cs-border">
                    <span className="cs-muted">Synthetic Ref</span>
                    <span className="font-mono font-semibold">{trackedRecord.requesterRef}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b cs-border">
                    <span className="cs-muted">Created</span>
                    <span className="font-mono">{formatTimestamp(trackedRecord.createdAt)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 3: STATUS CONSOLE */}
      {subTab === 'console' && (
        <div className="space-y-4">
          {consoleFeedback && (
            <div
              className={`rounded-2xl border p-4 flex items-start justify-between gap-3 ${
                consoleFeedback.kind === 'rejected'
                  ? 'border-rose-400/40 bg-rose-500/15'
                  : 'border-emerald-400/40 bg-emerald-500/15'
              }`}
            >
              <div className="flex items-start gap-2.5">
                <i
                  className={`bi ${
                    consoleFeedback.kind === 'rejected'
                      ? 'bi-shield-exclamation text-rose-400'
                      : 'bi-check-circle-fill text-emerald-400'
                  } text-lg mt-0.5`}
                />
                <div>
                  <div className="text-sm font-bold">{consoleFeedback.title}</div>
                  <div className="text-xs cs-secondary mt-0.5">{consoleFeedback.message}</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setConsoleFeedback(null)}
                className="btn-cs btn-cs-ghost btn-cs-sm"
              >
                Dismiss
              </button>
            </div>
          )}

          <div className="glass-card p-5 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex flex-wrap gap-1.5">
                {FILTER_STATUSES.map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setStatusFilter(st)}
                    className={`btn-cs btn-cs-sm ${statusFilter === st ? 'btn-cs-primary' : 'btn-cs-ghost'}`}
                  >
                    {st}
                  </button>
                ))}
              </div>
              <input
                value={consoleSearch}
                onChange={(e) => setConsoleSearch(e.target.value)}
                placeholder="Filter ID, location, department..."
                className="cs-input md:w-72"
              />
            </div>

            <div className="overflow-x-auto rounded-2xl border cs-border">
              <table className="w-full text-left border-collapse text-xs sm:text-sm">
                <thead>
                  <tr className="border-b cs-border text-[11px] uppercase tracking-wider cs-muted">
                    <th className="py-3 px-4">Request ID</th>
                    <th className="py-3 px-4">Category &amp; Location</th>
                    <th className="py-3 px-4">Department</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Valid Next Actions &amp; Guardrail</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRequests.map((r) => {
                    const actions = VALID_ACTIONS[r.status] || [];
                    const illegalTarget = INVALID_JUMP_TARGET[r.status] || 'Resolved';
                    const isBusy = busyId === r.requestId;

                    return (
                      <tr key={r.requestId} className="border-b cs-border last:border-b-0 hover:bg-[rgba(122,170,255,0.05)]">
                        <td className="py-3 px-4 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => {
                              setSubTab('track');
                              lookupById(r.requestId);
                            }}
                            className="ticket-id cursor-pointer hover:underline"
                          >
                            {r.requestId}
                          </button>
                          <div className="text-[11px] font-mono cs-muted mt-1">{r.requesterRef}</div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-semibold">{r.category}</div>
                          <div className="text-xs cs-muted">{r.location}</div>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <SectorChip department={r.assignedDepartment} />
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <StatusBadge status={r.status} />
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap text-right">
                          <div className="inline-flex items-center justify-end gap-2">
                            {actions.length === 0 ? (
                              <span className="text-xs cs-muted italic">Terminal</span>
                            ) : (
                              actions.map((act) => (
                                <button
                                  key={act.nextStatus}
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() => triggerTransition(r.requestId, act.nextStatus, false)}
                                  className={`btn-cs btn-cs-sm ${act.btnClass}`}
                                >
                                  {act.label}
                                </button>
                              ))
                            )}
                            <button
                              type="button"
                              disabled={isBusy}
                              title={`Test illegal jump: ${r.status} -> ${illegalTarget}`}
                              onClick={() => triggerTransition(r.requestId, illegalTarget, true)}
                              className="btn-cs btn-cs-danger btn-cs-sm"
                            >
                              <i className="bi bi-slash-circle" />
                              Test Invalid Jump
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredRequests.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-sm cs-muted">
                        No requests match the current filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
