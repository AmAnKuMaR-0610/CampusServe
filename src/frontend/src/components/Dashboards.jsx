import { useState } from 'react';
import {
  CATEGORIES,
  SECTORS_META,
  STATUS_PROGRESS,
  formatTimestamp,
  getGreeting,
  getTodayLabel,
} from '../constants.js';
import { SectorChip, StatusBadge } from './StatusBadge.jsx';

export function StudentDashboard({
  session,
  requests,
  announcements,
  posts,
  locations,
  onNavigate,
  onTrackRequest,
  onRefreshAll,
}) {
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [quickErr, setQuickErr] = useState('');
  const [quickSuccess, setQuickSuccess] = useState(null);

  const openCount = requests.filter((r) => r.status === 'Submitted' || r.status === 'Assigned').length;
  const inProgressCount = requests.filter((r) => r.status === 'In progress').length;
  const resolvedCount = requests.filter((r) => r.status === 'Resolved' || r.status === 'Closed').length;
  const decisions = posts.filter((p) => p.kind === 'decision');
  const feedPosts = posts.filter((p) => p.kind !== 'decision').slice(0, 3);

  async function handleQuickSubmit(e) {
    e.preventDefault();
    setQuickErr('');
    setQuickSuccess(null);
    setSubmitting(true);
    try {
      const ref = session.syntheticId.startsWith('STU-') ? session.syntheticId : 'STU-1042';
      const res = await fetch('/api/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, location, description, requesterRef: ref }),
      });
      const data = await res.json();
      if (!res.ok) {
        setQuickErr(Array.isArray(data.details) ? data.details.join(' ') : data.error || 'Submission failed');
        return;
      }
      setQuickSuccess(data);
      setLocation('');
      setDescription('');
      await onRefreshAll();
    } catch {
      setQuickErr('Network error while contacting backend API.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="page-head">
        <div>
          <div className="eyebrow">{getTodayLabel()}</div>
          <h1 className="page-title">
            {getGreeting()}, <span className="gradient-text">{session.displayLabel}</span>
          </h1>
          <p className="page-sub">
            Here&apos;s what&apos;s moving across BMSCE today — your service requests, active decisions, and campus notices.
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <button type="button" onClick={() => onNavigate('requests')} className="btn-cs btn-cs-primary">
            <i className="bi bi-plus-lg" />
            Submit &amp; Track
          </button>
          <button type="button" onClick={() => onNavigate('campusbot')} className="btn-cs btn-cs-secondary">
            <i className="bi bi-robot" />
            Ask CampusBot
          </button>
        </div>
      </section>

      {/* KPI Summary Cards */}
      <section className="stat-grid">
        <div className="stat-card tone-blue cursor-pointer" onClick={() => onNavigate('requests')}>
          <div className="stat-icon"><i className="bi bi-layers" /></div>
          <div className="stat-label">Total Requests</div>
          <div className="stat-value">{requests.length}</div>
          <div className="stat-sub">Persisted in Floci Firestore</div>
        </div>
        <div className="stat-card tone-amber cursor-pointer" onClick={() => onNavigate('requests')}>
          <div className="stat-icon"><i className="bi bi-hourglass-split" /></div>
          <div className="stat-label">Submitted / Open</div>
          <div className="stat-value">{openCount}</div>
          <div className="stat-sub">Awaiting pickup / assignment</div>
        </div>
        <div className="stat-card tone-cyan cursor-pointer" onClick={() => onNavigate('requests')}>
          <div className="stat-icon"><i className="bi bi-gear-wide-connected" /></div>
          <div className="stat-label">In Progress</div>
          <div className="stat-value">{inProgressCount}</div>
          <div className="stat-sub">Active department work</div>
        </div>
        <div className="stat-card tone-green cursor-pointer" onClick={() => onNavigate('requests')}>
          <div className="stat-icon"><i className="bi bi-check2-circle" /></div>
          <div className="stat-label">Resolved / Closed</div>
          <div className="stat-value">{resolvedCount}</div>
          <div className="stat-sub">Completed lifecycle tickets</div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-8 space-y-5">
          {/* Quick Submit Card */}
          <div className="glass-card p-5">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div>
                <h2 className="text-base font-bold">Quick Submit Request</h2>
                <p className="text-xs cs-muted">Auto-routed to the owning BMSCE department with a non-guessable REQ- ID.</p>
              </div>
              <button type="button" onClick={() => onNavigate('requests')} className="text-xs font-semibold cs-brand bg-transparent border-0 cursor-pointer">
                Full console <i className="bi bi-arrow-right" />
              </button>
            </div>

            {quickErr && (
              <div className="mb-3 rounded-xl border border-rose-400/40 bg-rose-500/15 px-3 py-2 text-xs text-rose-200">
                {quickErr}
              </div>
            )}
            {quickSuccess && (
              <div className="mb-3 rounded-xl border border-emerald-400/40 bg-emerald-500/15 px-3.5 py-2.5 text-xs flex flex-wrap items-center justify-between gap-2">
                <span>
                  Created <code className="font-mono font-bold">{quickSuccess.requestId}</code> → routed to{' '}
                  <strong>{quickSuccess.assignedDepartment}</strong>
                </span>
                <button
                  type="button"
                  onClick={() => onTrackRequest(quickSuccess.requestId)}
                  className="btn-cs btn-cs-secondary btn-cs-sm"
                >
                  Track ID →
                </button>
              </div>
            )}

            <form onSubmit={handleQuickSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="cs-select">
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <input
                list="quick-bmsce-locs"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Room / Location (e.g., Main Block (A) · A-303)"
                className="cs-input"
              />
              <datalist id="quick-bmsce-locs">
                {locations.map((l) => (
                  <option key={l.room} value={`${l.building} · ${l.room} ${l.name}`} />
                ))}
              </datalist>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the issue (10–500 chars)..."
                className="cs-textarea sm:col-span-2"
              />
              <div className="sm:col-span-2 flex items-center justify-between gap-2">
                <span className="text-[11px] cs-muted">
                  Requester Ref: <code className="font-mono">{session.syntheticId.startsWith('STU-') ? session.syntheticId : 'STU-1042'}</code>
                </span>
                <button type="submit" disabled={submitting} className="btn-cs btn-cs-primary btn-cs-sm">
                  <i className="bi bi-send" />
                  {submitting ? 'Submitting...' : 'Submit Ticket'}
                </button>
              </div>
            </form>
          </div>

          {/* Recent Requests */}
          <div className="glass-card p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-bold">Recent Service Requests</h2>
                <p className="text-xs cs-muted">Live status &amp; auto-assigned sector teams</p>
              </div>
              <button type="button" onClick={() => onNavigate('requests')} className="text-xs font-semibold cs-brand bg-transparent border-0 cursor-pointer">
                View all <i className="bi bi-arrow-right" />
              </button>
            </div>

            <div className="space-y-3">
              {requests.slice(0, 5).map((r) => {
                const pct = STATUS_PROGRESS[r.status] || 20;
                return (
                  <div
                    key={r.requestId}
                    onClick={() => onTrackRequest(r.requestId)}
                    className="p-3.5 rounded-2xl border cs-border hover:border-[var(--glass-border-strong)] bg-[rgba(122,170,255,0.04)] cursor-pointer transition-all"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="ticket-id">{r.requestId}</span>
                        <StatusBadge status={r.status} />
                        <SectorChip department={r.assignedDepartment} />
                      </div>
                      <span className="text-[11px] cs-muted font-mono">{formatTimestamp(r.updatedAt)}</span>
                    </div>
                    <p className="text-sm font-semibold truncate">{r.location}</p>
                    <p className="text-xs cs-secondary truncate mt-0.5">{r.category} · {r.description}</p>
                    <div className="progress-cs mt-2.5">
                      <div className="progress-bar-cs" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
              {requests.length === 0 && (
                <p className="text-sm cs-muted py-4 text-center">
                  No requests yet. Click <strong>Seed Synthetic Demo Data</strong> in the top bar or submit above.
                </p>
              )}
            </div>
          </div>

          {/* Community Feed Preview */}
          <div className="glass-card p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-base font-bold">From the Campus Feed</h2>
                <p className="text-xs cs-muted">Recent synthetic community posts</p>
              </div>
              <button type="button" onClick={() => onNavigate('posts')} className="text-xs font-semibold cs-brand bg-transparent border-0 cursor-pointer">
                Open feed <i className="bi bi-arrow-right" />
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {feedPosts.map((p) => (
                <div
                  key={p.id}
                  onClick={() => onNavigate('posts')}
                  className="p-3.5 rounded-2xl border cs-border bg-[rgba(122,170,255,0.04)] cursor-pointer flex flex-col justify-between gap-2"
                >
                  <div>
                    <div className="text-[11px] cs-muted mb-1">{p.authorLabel}</div>
                    <h3 className="text-sm font-semibold line-clamp-2">{p.title}</h3>
                    <p className="text-xs cs-secondary line-clamp-2 mt-1">{p.body}</p>
                  </div>
                  <div className="flex items-center justify-between text-xs cs-muted pt-2 border-t cs-border">
                    <span><i className="bi bi-arrow-up-circle mr-1" />{p.upvotes || 0}</span>
                    <span className="sector-chip sector-blue">{p.category}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Sidebar: Decisions & Announcements */}
        <div className="lg:col-span-4 space-y-5">
          <div className="glass-card p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold">Campus Decisions</h2>
              <button type="button" onClick={() => onNavigate('decisions')} className="text-xs font-semibold cs-brand bg-transparent border-0 cursor-pointer">
                All
              </button>
            </div>
            <div className="space-y-3">
              {decisions.slice(0, 3).map((d) => (
                <div
                  key={d.id}
                  onClick={() => onNavigate('decisions')}
                  className="pb-2.5 border-b cs-border last:border-b-0 cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs font-semibold">{d.title}</span>
                    <StatusBadge status={d.status} />
                  </div>
                  <p className="text-[11px] cs-muted mt-1">{d.upvotes || 0} votes cast</p>
                </div>
              ))}
            </div>
            <button type="button" onClick={() => onNavigate('decisions')} className="btn-cs btn-cs-secondary btn-cs-sm w-full mt-3">
              Review &amp; Vote
            </button>
          </div>

          <div className="glass-card p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold">Official Notices</h2>
              <button type="button" onClick={() => onNavigate('announcements')} className="text-xs font-semibold cs-brand bg-transparent border-0 cursor-pointer">
                All
              </button>
            </div>
            <div className="space-y-3">
              {announcements.slice(0, 3).map((a) => (
                <div key={a.id} className="pb-2.5 border-b cs-border last:border-b-0">
                  <div className="text-xs font-semibold">{a.title}</div>
                  <p className="text-xs cs-secondary line-clamp-2 mt-0.5">{a.description}</p>
                  <div className="text-[11px] cs-muted mt-1">{a.publishedBy}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AdminDashboard({
  requests,
  analytics,
  onNavigate,
  onTrackRequest,
  onTransition,
}) {
  const openQueue = requests.filter((r) => r.status === 'Submitted' || r.status === 'Assigned');
  const sectorCounts = analytics?.byDepartment || {};
  const maxSector = Math.max(1, ...Object.values(sectorCounts));

  return (
    <div className="space-y-6">
      <section className="page-head">
        <div>
          <div className="eyebrow">{getTodayLabel()} · Command Centre</div>
          <h1 className="page-title">Campus Operations</h1>
          <p className="page-sub">
            System-wide visibility of service queues, automated department routing, and Floci GCP telemetry.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => onNavigate('routing')} className="btn-cs btn-cs-primary">
            <i className="bi bi-diagram-3" />
            Sector Routing
          </button>
          <button type="button" onClick={() => onNavigate('analytics')} className="btn-cs btn-cs-secondary">
            <i className="bi bi-graph-up-arrow" />
            Analytics
          </button>
          <button type="button" onClick={() => onNavigate('audit')} className="btn-cs btn-cs-ghost">
            <i className="bi bi-journal-check" />
            Audit Log
          </button>
        </div>
      </section>

      <section className="stat-grid">
        <div className="stat-card tone-blue">
          <div className="stat-icon"><i className="bi bi-ticket-detailed" /></div>
          <div className="stat-label">Total Requests</div>
          <div className="stat-value">{analytics?.totalRequests ?? requests.length}</div>
          <div className="stat-sub">{analytics?.resolutionRate ?? 0}% resolved/closed</div>
        </div>
        <div className="stat-card tone-amber">
          <div className="stat-icon"><i className="bi bi-hourglass-split" /></div>
          <div className="stat-label">Submitted / Open</div>
          <div className="stat-value">{analytics?.openRequests ?? openQueue.length}</div>
          <div className="stat-sub">Awaiting completion</div>
        </div>
        <div className="stat-card tone-cyan">
          <div className="stat-icon"><i className="bi bi-gear" /></div>
          <div className="stat-label">In Progress</div>
          <div className="stat-value">{analytics?.inProgressRequests ?? 0}</div>
          <div className="stat-sub">Active work</div>
        </div>
        <div className="stat-card tone-green">
          <div className="stat-icon"><i className="bi bi-check2-circle" /></div>
          <div className="stat-label">Resolved / Closed</div>
          <div className="stat-value">{analytics?.resolvedOrClosed ?? 0}</div>
          <div className="stat-sub">Completed tickets</div>
        </div>
        <div className="stat-card tone-rose">
          <div className="stat-icon"><i className="bi bi-alarm" /></div>
          <div className="stat-label">SLA Overdue</div>
          <div className="stat-value">{analytics?.overdueCount ?? 0}</div>
          <div className="stat-sub">Beyond {analytics?.slaHours ?? 48}h</div>
        </div>
        <div className="stat-card tone-violet">
          <div className="stat-icon"><i className="bi bi-check2-square" /></div>
          <div className="stat-label">Decisions</div>
          <div className="stat-value">{analytics?.totalDecisions ?? 0}</div>
          <div className="stat-sub">Campus proposals</div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Sector Routing Overview */}
        <div className="lg:col-span-7 space-y-5">
          <div className="glass-card p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-bold">Department Routing Overview</h2>
                <p className="text-xs cs-muted">Auto-routed distribution across 9 BMSCE support sectors</p>
              </div>
              <button type="button" onClick={() => onNavigate('routing')} className="text-xs font-semibold cs-brand bg-transparent border-0 cursor-pointer">
                Manage <i className="bi bi-arrow-right" />
              </button>
            </div>
            <div className="space-y-2.5">
              {Object.entries(SECTORS_META).map(([name, meta]) => {
                const count = sectorCounts[name] || 0;
                const pct = Math.round((count / maxSector) * 100);
                return (
                  <div key={name} className="flex items-center gap-3">
                    <span className={`sector-chip sector-${meta.tone}`} style={{ minWidth: 185 }}>
                      <i className={`bi ${meta.icon}`} />
                      {name}
                    </span>
                    <div className="progress-cs flex-1">
                      <div className="progress-bar-cs" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs font-semibold w-7 text-right tabular-nums">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Priority Queue */}
          <div className="glass-card p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold">Priority Open Queue</h2>
              <span className="badge-status badge-assigned">{openQueue.length} open</span>
            </div>
            <div className="space-y-2.5">
              {openQueue.slice(0, 5).map((r) => (
                <div key={r.requestId} className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b cs-border last:border-b-0">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => onTrackRequest(r.requestId)}
                        className="ticket-id cursor-pointer hover:underline"
                      >
                        {r.requestId}
                      </button>
                      <StatusBadge status={r.status} />
                      <SectorChip department={r.assignedDepartment} />
                    </div>
                    <p className="text-xs cs-secondary truncate mt-1">{r.location} — {r.category}</p>
                  </div>
                  {r.status === 'Submitted' && (
                    <button
                      type="button"
                      onClick={() => onTransition(r.requestId, 'Assigned')}
                      className="btn-cs btn-cs-primary btn-cs-sm"
                    >
                      Assign
                    </button>
                  )}
                  {r.status === 'Assigned' && (
                    <button
                      type="button"
                      onClick={() => onTransition(r.requestId, 'In progress')}
                      className="btn-cs btn-cs-secondary btn-cs-sm"
                    >
                      Start Progress
                    </button>
                  )}
                </div>
              ))}
              {openQueue.length === 0 && (
                <p className="text-xs cs-muted">No open tickets waiting in the priority queue.</p>
              )}
            </div>
          </div>
        </div>

        {/* Right: Command Shortcuts & Cloud Status */}
        <div className="lg:col-span-5 space-y-5">
          <div className="glass-card p-5">
            <h2 className="text-base font-bold mb-3">Command Shortcuts</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button type="button" onClick={() => onNavigate('routing')} className="command-tile">
                <span className="ci"><i className="bi bi-diagram-3" /></span>
                <span><strong className="block text-sm">Sector Routing</strong><span className="text-xs cs-muted">9-team triage board</span></span>
              </button>
              <button type="button" onClick={() => onNavigate('analytics')} className="command-tile">
                <span className="ci"><i className="bi bi-graph-up-arrow" /></span>
                <span><strong className="block text-sm">Analytics</strong><span className="text-xs cs-muted">Breakdown &amp; load</span></span>
              </button>
              <button type="button" onClick={() => onNavigate('audit')} className="command-tile">
                <span className="ci"><i className="bi bi-journal-check" /></span>
                <span><strong className="block text-sm">Audit Log</strong><span className="text-xs cs-muted">Redacted state trail</span></span>
              </button>
              <button type="button" onClick={() => onNavigate('cloud')} className="command-tile">
                <span className="ci"><i className="bi bi-shield-check" /></span>
                <span><strong className="block text-sm">Cloud Verify</strong><span className="text-xs cs-muted">Floci &amp; Zero-PII logs</span></span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ProfileView({ session, requests, onNavigate, onTrackRequest, onLogout }) {
  const myReports = session.role === 'student'
    ? requests.filter((r) => r.requesterRef === session.syntheticId)
    : requests;

  const initials = session.syntheticId.slice(0, 3);

  return (
    <div className="space-y-6">
      <section className="glass-card p-6 flex flex-wrap items-center gap-5">
        <span className="avatar avatar-xl">{initials}</span>
        <div className="flex-1 min-w-0">
          <div className="eyebrow">Synthetic Profile</div>
          <h1 className="page-title">{session.displayLabel}</h1>
          <p className="page-sub">
            {session.department}
            {session.semester ? ` · Semester ${session.semester}` : ''} · {session.mode}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button type="button" onClick={() => onNavigate('requests')} className="btn-cs btn-cs-primary btn-cs-sm">
            <i className="bi bi-plus-lg" />
            New Request
          </button>
          <button type="button" onClick={onLogout} className="btn-cs btn-cs-danger btn-cs-sm">
            <i className="bi bi-box-arrow-right" />
            Switch Role / Sign Out
          </button>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-4 glass-card p-5 space-y-3">
          <h2 className="text-base font-bold">Locked Synthetic Identity</h2>
          <p className="text-xs cs-muted">Privacy-first lab mode: no real names, emails, or passwords are stored.</p>
          <div className="space-y-2.5 text-sm">
            <div className="p-3 rounded-xl border cs-border bg-[rgba(122,170,255,0.05)]">
              <div className="text-[11px] uppercase tracking-wider cs-muted">Synthetic ID</div>
              <div className="font-mono font-bold mt-0.5">{session.syntheticId}</div>
            </div>
            <div className="p-3 rounded-xl border cs-border bg-[rgba(122,170,255,0.05)]">
              <div className="text-[11px] uppercase tracking-wider cs-muted">Role</div>
              <div className="font-semibold capitalize mt-0.5">{session.role}</div>
            </div>
            <div className="p-3 rounded-xl border cs-border bg-[rgba(122,170,255,0.05)]">
              <div className="text-[11px] uppercase tracking-wider cs-muted">Department</div>
              <div className="font-semibold mt-0.5">{session.department}</div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-8 glass-card p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold">
              {session.role === 'student' ? 'Requests Under My Synthetic ID' : 'All Campus Requests'}
            </h2>
            <span className="text-xs cs-muted">{myReports.length} tickets</span>
          </div>
          <div className="space-y-2.5">
            {myReports.map((r) => (
              <div
                key={r.requestId}
                onClick={() => onTrackRequest(r.requestId)}
                className="flex items-center justify-between gap-3 p-3 rounded-xl border cs-border hover:border-[var(--glass-border-strong)] cursor-pointer"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="ticket-id">{r.requestId}</span>
                    <span className="text-xs font-semibold">{r.category}</span>
                  </div>
                  <p className="text-xs cs-muted truncate mt-0.5">{r.location}</p>
                </div>
                <StatusBadge status={r.status} />
              </div>
            ))}
            {myReports.length === 0 && (
              <p className="text-xs cs-muted py-4 text-center">No tickets found for {session.syntheticId}.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
