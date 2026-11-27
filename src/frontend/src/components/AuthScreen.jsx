import { useState } from 'react';
import { CAMPUS_DEPARTMENTS } from '../constants.js';
import { ThemePicker } from './ThemePicker.jsx';

export function AuthScreen({ theme, onChangeTheme, health, onAuthenticated }) {
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [role, setRole] = useState('student');
  const [syntheticId, setSyntheticId] = useState('STU-1042');
  const [department, setDepartment] = useState(CAMPUS_DEPARTMENTS[0]);
  const [semester, setSemester] = useState(3);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isConnected = health?.status === 'ok';

  function handleRoleChange(nextRole) {
    setRole(nextRole);
    setError('');
    if (nextRole === 'student' && !syntheticId.startsWith('STU-')) setSyntheticId('STU-1042');
    if (nextRole === 'faculty' && !syntheticId.startsWith('FAC-')) setSyntheticId('FAC-201');
    if (nextRole === 'admin' && !syntheticId.startsWith('ADM-')) setSyntheticId('ADM-001');
  }

  async function submitAuth(targetId, targetRole, endpoint = '/api/auth/login') {
    setError('');
    setLoading(true);
    try {
      const payload =
        endpoint === '/api/auth/register'
          ? { syntheticId: targetId, role: targetRole, department, semester }
          : { syntheticId: targetId, role: targetRole };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Authentication failed');
        return;
      }
      onAuthenticated(data.session);
    } catch {
      setError('Unable to reach CampusServe backend API on port 4000.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-shell">
      <header className="auth-top">
        <div className="brand">
          <span className="brand-mark">
            <i className="bi bi-mortarboard-fill" />
          </span>
          <span>
            <span className="brand-name">CampusServe</span>
            <span className="brand-sub">BMSCE Workspace</span>
          </span>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <span className={`badge-status ${isConnected ? 'badge-active' : 'badge-overdue'}`}>
            <i className="bi bi-cloud-check" />
            {isConnected ? 'Floci GCP Connected • localhost:4588' : 'Backend Connecting...'}
          </span>
          <span className="hidden sm:inline text-xs cs-muted">Report → Discuss → Decide → Act</span>
          <ThemePicker theme={theme} onChangeTheme={onChangeTheme} />
        </div>
      </header>

      <main className="auth-main">
        <div className="auth-split">
          {/* Left Showcase */}
          <section className="auth-showcase">
            <div>
              <span className="badge-status badge-in-progress">
                <i className="bi bi-broadcast" />
                Live Floci GCP Operations
              </span>
              <h1 className="gradient-text">
                Your campus,
                <br />
                fixed together.
              </h1>
              <p className="cs-secondary text-sm leading-relaxed max-w-md">
                One shared cloud service desk to report campus issues, auto-route departments, vote on proposals, and verify every transition in real time.
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <div className="auth-feature">
                <span className="fi"><i className="bi bi-lightning-charge" /></span>
                <span>Auto-route requests to 9 BMSCE support sectors</span>
              </div>
              <div className="auth-feature">
                <span className="fi"><i className="bi bi-shield-check" /></span>
                <span>Zero-PII Cloud Logging &amp; non-guessable REQ- IDs</span>
              </div>
              <div className="auth-feature">
                <span className="fi"><i className="bi bi-graph-up-arrow" /></span>
                <span>Strict state-machine lifecycle &amp; immutable audit trail</span>
              </div>
            </div>

            <div className="flex gap-6 text-xs cs-muted">
              <div>
                <strong className="block cs-txt text-lg">9</strong>Sectors
              </div>
              <div>
                <strong className="block cs-txt text-lg">48h</strong>Response SLA
              </div>
              <div>
                <strong className="block cs-txt text-lg">100%</strong>Redacted Logs
              </div>
            </div>
          </section>

          {/* Right Auth Card */}
          <section className="glass-card auth-card">
            <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
              <span className="badge-status badge-assigned">
                <i className="bi bi-incognito" />
                Synthetic Lab Mode — No Real Personal Data
              </span>
            </div>

            <h2 className="text-2xl font-bold mb-1">
              {mode === 'login' ? 'Welcome back' : 'Create synthetic profile'}
            </h2>
            <p className="text-sm cs-muted mb-5">
              {mode === 'login'
                ? 'Sign in with a synthetic role ID to enter your campus workspace.'
                : 'Register a synthetic STU / FAC / ADM profile — zero real names or emails.'}
            </p>

            {error && (
              <div className="mb-4 rounded-xl border border-rose-400/40 bg-rose-500/15 px-3.5 py-2.5 text-xs text-rose-200 flex items-center gap-2">
                <i className="bi bi-exclamation-octagon-fill text-rose-400" />
                <span>{error}</span>
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                submitAuth(syntheticId, role, mode === 'login' ? '/api/auth/login' : '/api/auth/register');
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-semibold cs-secondary mb-1.5">Select Role</label>
                <div className="segmented grid-cols-3">
                  {[
                    { id: 'student', label: 'Student', icon: 'bi-mortarboard' },
                    { id: 'faculty', label: 'Faculty', icon: 'bi-person-workspace' },
                    { id: 'admin', label: 'Admin', icon: 'bi-shield-lock' },
                  ].map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => handleRoleChange(r.id)}
                      className={`py-2 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        role === r.id
                          ? 'bg-[var(--brand-soft)] text-[var(--brand)] border border-[var(--glass-border-strong)]'
                          : 'cs-secondary hover:cs-txt'
                      }`}
                    >
                      <i className={`bi ${r.icon}`} />
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label htmlFor="syntheticId" className="block text-xs font-semibold cs-secondary mb-1.5">
                  Synthetic Reference ID
                </label>
                <input
                  id="syntheticId"
                  type="text"
                  value={syntheticId}
                  onChange={(e) => setSyntheticId(e.target.value.toUpperCase())}
                  placeholder={role === 'student' ? 'STU-1042' : role === 'faculty' ? 'FAC-201' : 'ADM-001'}
                  className="cs-input font-mono"
                  required
                />
                <p className="text-[11px] cs-muted mt-1">
                  Format: <code className="font-mono">STU-XXXX</code>, <code className="font-mono">FAC-XXX</code>, or <code className="font-mono">ADM-XXX</code>. No passwords or emails required.
                </p>
              </div>

              {mode === 'register' && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold cs-secondary mb-1.5">Department</label>
                    <select
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      className="cs-select"
                    >
                      {CAMPUS_DEPARTMENTS.map((d) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                  {role === 'student' && (
                    <div>
                      <label className="block text-xs font-semibold cs-secondary mb-1.5">Semester</label>
                      <select
                        value={semester}
                        onChange={(e) => setSemester(Number(e.target.value))}
                        className="cs-select"
                      >
                        {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                          <option key={s} value={s}>Sem {s}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="btn-cs btn-cs-primary w-full py-2.5"
              >
                {loading
                  ? 'Connecting...'
                  : mode === 'login'
                  ? 'Enter Workspace'
                  : 'Create Synthetic Profile'}
                <i className="bi bi-arrow-right" />
              </button>
            </form>

            {/* 1-Click Synthetic Demo Login Buttons */}
            <div className="mt-5 rounded-2xl p-3.5 border cs-border bg-[color-mix(in_srgb,var(--brand)_7%,transparent)]">
              <div className="text-[11px] uppercase tracking-wider font-bold cs-muted mb-2.5">
                1-Click Synthetic Demo Login
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => submitAuth('STU-1042', 'student')}
                  className="btn-cs btn-cs-secondary btn-cs-sm"
                >
                  <i className="bi bi-mortarboard" />
                  Student STU-1042
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => submitAuth('FAC-201', 'faculty')}
                  className="btn-cs btn-cs-secondary btn-cs-sm"
                >
                  <i className="bi bi-person-workspace" />
                  Faculty FAC-201
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => submitAuth('ADM-001', 'admin')}
                  className="btn-cs btn-cs-secondary btn-cs-sm"
                >
                  <i className="bi bi-shield-lock" />
                  Admin ADM-001
                </button>
              </div>
            </div>

            <p className="text-center text-xs cs-muted mt-4 mb-0">
              {mode === 'login' ? (
                <>
                  Need a custom synthetic ID?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setMode('register');
                      setError('');
                    }}
                    className="cs-brand font-semibold bg-transparent border-0 cursor-pointer underline"
                  >
                    Create synthetic profile
                  </button>
                </>
              ) : (
                <>
                  Already have a synthetic ID?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setMode('login');
                      setError('');
                    }}
                    className="cs-brand font-semibold bg-transparent border-0 cursor-pointer underline"
                  >
                    Return to sign in
                  </button>
                </>
              )}
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
