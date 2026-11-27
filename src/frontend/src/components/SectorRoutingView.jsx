import { SECTORS_META, VALID_ACTIONS } from '../constants.js';
import { SectorChip, StatusBadge } from './StatusBadge.jsx';

export function SectorRoutingView({ requests, onTransition, onTrackRequest }) {
  const sectorNames = Object.keys(SECTORS_META);
  const buckets = {};
  for (const name of sectorNames) buckets[name] = [];
  for (const r of requests) {
    const dept = r.assignedDepartment && buckets[r.assignedDepartment]
      ? r.assignedDepartment
      : 'IT Services';
    buckets[dept].push(r);
  }

  return (
    <div className="space-y-5">
      <section className="page-head">
        <div>
          <div className="eyebrow">Admin · Triage</div>
          <h1 className="page-title">Sector Routing Board</h1>
          <p className="page-sub">
            Requests are automatically routed across 9 BMSCE support sectors using category and keyword rules. Advance valid states directly from each lane.
          </p>
        </div>
        <span className="badge-status badge-assigned">{requests.length} total tickets</span>
      </section>

      <div className="kanban">
        {sectorNames.map((name) => {
          const meta = SECTORS_META[name];
          const lane = buckets[name] || [];
          return (
            <div key={name} className="lane flex flex-col gap-2.5">
              <div className="flex items-center gap-2.5 pb-2 border-b cs-border">
                <span className="w-8 h-8 rounded-xl bg-[var(--brand-soft)] cs-brand grid place-items-center shrink-0">
                  <i className={`bi ${meta.icon}`} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold truncate">{name}</div>
                  <SectorChip department={name} />
                </div>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-[rgba(122,170,255,0.14)]">
                  {lane.length}
                </span>
              </div>

              {lane.length === 0 ? (
                <div className="text-xs cs-muted text-center py-5 border border-dashed cs-border rounded-xl">
                  No requests routed here.
                </div>
              ) : (
                lane.map((r) => {
                  const actions = VALID_ACTIONS[r.status] || [];
                  return (
                    <div key={r.requestId} className="route-card space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => onTrackRequest(r.requestId)}
                          className="ticket-id cursor-pointer hover:underline"
                        >
                          {r.requestId}
                        </button>
                        <StatusBadge status={r.status} />
                      </div>
                      <div className="font-semibold text-xs truncate">{r.location}</div>
                      <div className="text-[11px] cs-muted">{r.category} · {r.requesterRef}</div>
                      {actions.length > 0 && (
                        <div className="flex gap-1.5 pt-1">
                          {actions.map((act) => (
                            <button
                              key={act.nextStatus}
                              type="button"
                              onClick={() => onTransition(r.requestId, act.nextStatus)}
                              className={`btn-cs btn-cs-sm ${act.btnClass}`}
                            >
                              {act.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
