import { useState } from 'react';

function ServiceCard({ title, iconClass, service }) {
  const isVerified = service?.status === 'verified-emulator';

  return (
    <div className="glass-card p-5 flex flex-col justify-between gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="stat-icon mb-0">
            <i className={`bi ${iconClass}`} />
          </span>
          <div>
            <h3 className="text-sm font-bold">{title}</h3>
            <p className="text-xs font-mono cs-muted">{service?.sdk || 'GCP Adapter'}</p>
          </div>
        </div>
        <span className={`badge-status ${isVerified ? 'badge-resolved' : 'badge-in-progress'}`}>
          <i className={`bi ${isVerified ? 'bi-check-circle' : 'bi-exclamation-triangle'}`} />
          {service?.status || 'checking'}
        </span>
      </div>

      <div className="rounded-xl border cs-border bg-[rgba(122,170,255,0.05)] p-3 text-xs space-y-1">
        <div className="truncate">
          <span className="cs-muted">Target:</span>{' '}
          <code className="font-mono">{service?.target || 'localhost:4588'}</code>
        </div>
        {service?.collection && (
          <div>
            <span className="cs-muted">Collection:</span>{' '}
            <code className="font-mono">{service.collection}</code>
          </div>
        )}
        {service?.logName && (
          <div className="truncate">
            <span className="cs-muted">Log Stream:</span>{' '}
            <code className="font-mono">{service.logName}</code>
          </div>
        )}
        {service?.runtime && (
          <div>
            <span className="cs-muted">Runtime:</span> {service.runtime}
          </div>
        )}
      </div>
    </div>
  );
}

export function CloudVerificationView({ health, logs, onRefreshLogs }) {
  const [viewMode, setViewMode] = useState('table');
  const [refreshing, setRefreshing] = useState(false);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await onRefreshLogs();
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="page-head">
        <div>
          <div className="eyebrow">Floci GCP Emulator · localhost:4588</div>
          <h1 className="page-title">Cloud &amp; Privacy Verification</h1>
          <p className="page-sub">
            Live verification of Cloud Run, Cloud Firestore, and Cloud Logging on Floci v0.13.0 plus Zero-PII structured log inspection.
          </p>
        </div>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <ServiceCard title="Cloud Run" iconClass="bi-cloud-check" service={health?.services?.cloudRun} />
        <ServiceCard title="Cloud Firestore" iconClass="bi-database" service={health?.services?.firestore} />
        <ServiceCard title="Cloud Logging" iconClass="bi-journal-text" service={health?.services?.logging} />
      </div>

      <div className="glass-card p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold">Privacy-Safe Structured Log Viewer</h2>
            <p className="text-xs cs-muted">
              Live entries from <code className="font-mono">/api/logs</code> — strictly restricted to metadata keys only.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`btn-cs btn-cs-sm ${viewMode === 'table' ? 'btn-cs-primary' : 'btn-cs-ghost'}`}
            >
              <i className="bi bi-table" />
              Table
            </button>
            <button
              type="button"
              onClick={() => setViewMode('json')}
              className={`btn-cs btn-cs-sm ${viewMode === 'json' ? 'btn-cs-primary' : 'btn-cs-ghost'}`}
            >
              <i className="bi bi-braces" />
              Raw JSON
            </button>
            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing}
              className="btn-cs btn-cs-secondary btn-cs-sm"
            >
              <i className={`bi bi-arrow-clockwise ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-emerald-400/35 bg-emerald-500/12 px-4 py-2.5 text-xs flex items-center gap-2">
          <i className="bi bi-shield-check text-emerald-400 text-base shrink-0" />
          <span>
            <strong>Zero-PII Audit Enforcement:</strong> Every Cloud Logging entry contains ONLY{' '}
            <code className="font-mono">timestamp</code>, <code className="font-mono">requestId</code>,{' '}
            <code className="font-mono">operation</code>, <code className="font-mono">result</code>,{' '}
            <code className="font-mono">statusCode</code>, and <code className="font-mono">latencyMs</code>.{' '}
            Descriptions, student refs, locations, posts, and login payloads are never logged.
          </span>
        </div>

        {viewMode === 'json' ? (
          <pre className="rounded-2xl bg-slate-950/90 text-slate-100 p-4 text-xs font-mono overflow-x-auto max-h-96 border cs-border">
            {JSON.stringify(logs, null, 2)}
          </pre>
        ) : (
          <div className="overflow-x-auto rounded-2xl border cs-border">
            <table className="w-full text-left border-collapse text-xs font-mono">
              <thead>
                <tr className="border-b cs-border text-[11px] uppercase tracking-wider cs-muted font-sans">
                  <th className="py-2.5 px-3">Timestamp</th>
                  <th className="py-2.5 px-3">Operation</th>
                  <th className="py-2.5 px-3">Request ID</th>
                  <th className="py-2.5 px-3">Result</th>
                  <th className="py-2.5 px-3">HTTP</th>
                  <th className="py-2.5 px-3 text-right">Latency</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((entry, idx) => (
                  <tr key={`${entry.timestamp}-${idx}`} className="border-b cs-border last:border-b-0">
                    <td className="py-2 px-3 cs-muted whitespace-nowrap">{entry.timestamp}</td>
                    <td className="py-2 px-3 font-bold">{entry.operation}</td>
                    <td className="py-2 px-3 cs-brand whitespace-nowrap">{entry.requestId || '—'}</td>
                    <td className="py-2 px-3 cs-secondary whitespace-nowrap">{entry.result}</td>
                    <td className="py-2 px-3 whitespace-nowrap">
                      <span className={`badge-status ${entry.statusCode >= 400 ? 'badge-overdue' : 'badge-resolved'}`}>
                        {entry.statusCode}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right cs-muted whitespace-nowrap">{entry.latencyMs} ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
