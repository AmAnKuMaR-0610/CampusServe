import { SECTORS_META, formatTimestamp } from '../constants.js';
import { SectorChip, StatusBadge } from './StatusBadge.jsx';

export function AnalyticsView({ analytics, onNavigate }) {
  const rate = analytics?.resolutionRate ?? 0;
  const total = Math.max(1, analytics?.totalRequests ?? 1);
  const byStatus = analytics?.byStatus || {};
  const byCategory = analytics?.byCategory || {};
  const byDepartment = analytics?.byDepartment || {};
  const byLocation = analytics?.byLocation || {};

  const statusColors = {
    Submitted: '#94a3b8',
    Assigned: '#38bdf8',
    'In progress': '#fbbf24',
    Resolved: '#4ade80',
    Closed: '#a78bfa',
  };

  return (
    <div className="space-y-5">
      <section className="page-head">
        <div>
          <div className="eyebrow">Admin · Insights</div>
          <h1 className="page-title">Service Desk Analytics</h1>
          <p className="page-sub">Aggregated counts by status, category, location, and auto-routed department from Floci Firestore.</p>
        </div>
        <button type="button" onClick={() => onNavigate('audit')} className="btn-cs btn-cs-secondary btn-cs-sm">
          <i className="bi bi-journal-check" />
          View Audit Log
        </button>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-4 glass-card p-5 space-y-4">
          <h2 className="text-base font-bold">Resolution Rate</h2>
          <div
            className="ring"
            style={{
              background: `conic-gradient(var(--brand) ${rate}%, rgba(122, 170, 255, 0.14) 0)`,
            }}
          >
            <div className="ring-inner">
              <strong>{rate}%</strong>
              <span>Resolved</span>
            </div>
          </div>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between"><span className="cs-muted">Total Requests</span><span className="font-bold">{analytics?.totalRequests ?? 0}</span></div>
            <div className="flex justify-between"><span className="cs-muted">Submitted / Open</span><span className="font-bold">{analytics?.openRequests ?? 0}</span></div>
            <div className="flex justify-between"><span className="cs-muted">In Progress</span><span className="font-bold">{analytics?.inProgressRequests ?? 0}</span></div>
            <div className="flex justify-between"><span className="cs-muted">Resolved / Closed</span><span className="font-bold">{analytics?.resolvedOrClosed ?? 0}</span></div>
          </div>
        </div>

        <div className="lg:col-span-8 glass-card p-5 space-y-3">
          <h2 className="text-base font-bold">Department / Sector Load</h2>
          {Object.entries(SECTORS_META).map(([name, meta]) => {
            const count = byDepartment[name] || 0;
            const pct = Math.round((count / total) * 100);
            return (
              <div key={name} className="flex items-center gap-3">
                <span className={`sector-chip sector-${meta.tone}`} style={{ minWidth: 185 }}>
                  <i className={`bi ${meta.icon}`} />
                  {name}
                </span>
                <div className="progress-cs flex-1">
                  <div className="progress-bar-cs" style={{ width: `${pct}%` }} />
                </div>
                <span className="text-xs font-mono w-16 text-right">{count} · {pct}%</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="glass-card p-5 space-y-3">
          <h3 className="text-sm font-bold">By Status</h3>
          {Object.entries(byStatus).map(([st, count]) => {
            const pct = Math.round((count / total) * 100);
            return (
              <div key={st}>
                <div className="flex justify-between text-xs mb-1">
                  <span>{st}</span>
                  <span className="cs-muted">{count} ({pct}%)</span>
                </div>
                <div className="progress-cs">
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, background: statusColors[st] || 'var(--brand)' }} />
                </div>
              </div>
            );
          })}
        </div>

        <div className="glass-card p-5 space-y-3">
          <h3 className="text-sm font-bold">By Category</h3>
          {Object.entries(byCategory).map(([cat, count]) => {
            const pct = Math.round((count / total) * 100);
            return (
              <div key={cat}>
                <div className="flex justify-between text-xs mb-1">
                  <span>{cat}</span>
                  <span className="cs-muted">{count} ({pct}%)</span>
                </div>
                <div className="progress-cs">
                  <div className="progress-bar-cs" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>

        <div className="glass-card p-5 space-y-3">
          <h3 className="text-sm font-bold">By Campus Block / Location</h3>
          {Object.entries(byLocation).map(([loc, count]) => (
            <div key={loc} className="flex justify-between items-center text-xs py-1.5 border-b cs-border last:border-b-0">
              <span className="font-medium truncate pr-2">{loc}</span>
              <span className="badge-status badge-submitted">{count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function AuditView({ auditEntries, onTrackRequest }) {
  return (
    <div className="space-y-5">
      <section className="page-head">
        <div>
          <div className="eyebrow">Admin · Accountability</div>
          <h1 className="page-title">Redacted Status Transition Audit Log</h1>
          <p className="page-sub">Immutable state-transition trail across all requests — descriptions and student refs excluded.</p>
        </div>
        <span className="badge-status badge-submitted">{auditEntries.length} transitions</span>
      </section>

      <div className="glass-card p-5 overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs sm:text-sm">
          <thead>
            <tr className="border-b cs-border text-[11px] uppercase tracking-wider cs-muted">
              <th className="py-3 px-3">Timestamp</th>
              <th className="py-3 px-3">Request ID</th>
              <th className="py-3 px-3">Category &amp; Sector</th>
              <th className="py-3 px-3">Transition</th>
              <th className="py-3 px-3">Changed By</th>
            </tr>
          </thead>
          <tbody>
            {auditEntries.map((e, i) => (
              <tr key={`${e.requestId}-${e.timestamp}-${i}`} className="border-b cs-border last:border-b-0">
                <td className="py-2.5 px-3 font-mono text-xs cs-muted whitespace-nowrap">{formatTimestamp(e.timestamp)}</td>
                <td className="py-2.5 px-3 whitespace-nowrap">
                  <button type="button" onClick={() => onTrackRequest(e.requestId)} className="ticket-id cursor-pointer hover:underline">
                    {e.requestId}
                  </button>
                </td>
                <td className="py-2.5 px-3">
                  <div className="font-semibold text-xs">{e.category}</div>
                  <SectorChip department={e.assignedDepartment} />
                </td>
                <td className="py-2.5 px-3 whitespace-nowrap">
                  <div className="flex items-center gap-1.5">
                    {e.fromStatus ? <span className="text-xs cs-muted">{e.fromStatus} →</span> : <span className="text-xs cs-muted">INIT →</span>}
                    <StatusBadge status={e.toStatus} />
                  </div>
                </td>
                <td className="py-2.5 px-3 font-mono text-xs cs-secondary">{e.changedBy}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function NotificationsView({ notifications, onTrackRequest }) {
  return (
    <div className="space-y-5">
      <section className="page-head">
        <div>
          <div className="eyebrow">Live Updates</div>
          <h1 className="page-title">Notifications</h1>
          <p className="page-sub">Status transitions on your service requests and recent campus announcements.</p>
        </div>
        <span className="badge-status badge-assigned">{notifications.length} alerts</span>
      </section>

      <div className="glass-card p-5 space-y-3">
        {notifications.map((n) => (
          <div key={n.id} className="flex items-start gap-3 pb-3 border-b cs-border last:border-b-0 last:pb-0">
            <span className="stat-icon mb-0 shrink-0">
              <i className={`bi ${n.type === 'announcement' ? 'bi-megaphone' : 'bi-bell-fill'}`} />
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-bold">{n.title}</h3>
                <span className="text-xs font-mono cs-muted">{formatTimestamp(n.timestamp)}</span>
              </div>
              <p className="text-xs cs-secondary mt-0.5">{n.message}</p>
              {n.requestId && (
                <button
                  type="button"
                  onClick={() => onTrackRequest(n.requestId)}
                  className="btn-cs btn-cs-ghost btn-cs-sm mt-2"
                >
                  Inspect {n.requestId} →
                </button>
              )}
            </div>
          </div>
        ))}
        {notifications.length === 0 && (
          <p className="text-sm cs-muted text-center py-6">No alerts yet.</p>
        )}
      </div>
    </div>
  );
}
