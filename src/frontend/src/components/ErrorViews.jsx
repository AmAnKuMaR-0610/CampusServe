export function ErrorStateCard({ code = 404, title, message, onBackHome, onBrowseRequests }) {
  const meta = {
    400: { icon: 'bi-exclamation-triangle', eyebrow: '400 · Bad request', defaultTitle: 'Invalid input or state transition' },
    404: { icon: 'bi-compass', eyebrow: '404 · Not found', defaultTitle: "We couldn't find that record" },
    500: { icon: 'bi-exclamation-octagon', eyebrow: '500 · Server error', defaultTitle: 'Unexpected backend error' },
  }[code] || { icon: 'bi-compass', eyebrow: `${code} · Error`, defaultTitle: 'Request could not be completed' };

  return (
    <div className="glass-card p-8 mx-auto text-center max-w-lg my-4">
      <div className="stat-icon mx-auto mb-3" style={{ width: 60, height: 60, borderRadius: 18 }}>
        <i className={`bi ${meta.icon} text-2xl`} />
      </div>
      <div className="eyebrow justify-center">{meta.eyebrow}</div>
      <h2 className="text-xl font-bold mb-2">{title || meta.defaultTitle}</h2>
      <p className="text-sm cs-secondary mb-5">
        {message || 'The record or resource you requested could not be found or validated.'}
      </p>
      <div className="flex gap-2 justify-center flex-wrap">
        {onBackHome && (
          <button type="button" onClick={onBackHome} className="btn-cs btn-cs-primary btn-cs-sm">
            Back to dashboard
          </button>
        )}
        {onBrowseRequests && (
          <button type="button" onClick={onBrowseRequests} className="btn-cs btn-cs-ghost btn-cs-sm">
            Open Requests Console
          </button>
        )}
      </div>
    </div>
  );
}
