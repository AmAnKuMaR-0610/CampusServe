import { useCallback, useEffect, useState } from 'react';
import { getGreeting } from './constants.js';
import { ThemePicker } from './components/ThemePicker.jsx';
import { AuthScreen } from './components/AuthScreen.jsx';
import { AdminDashboard, ProfileView, StudentDashboard } from './components/Dashboards.jsx';
import { RequestsWorkspace } from './components/RequestsWorkspace.jsx';
import { SectorRoutingView } from './components/SectorRoutingView.jsx';
import { LocationsView } from './components/LocationsView.jsx';
import { AnnouncementsView, DecisionsView, PostsView } from './components/CommunityViews.jsx';
import { CampusBotView } from './components/CampusBotView.jsx';
import { AnalyticsView, AuditView, NotificationsView } from './components/AdminInsightsViews.jsx';
import { CloudVerificationView } from './components/CloudVerificationView.jsx';

function getInitialTheme() {
  try {
    const saved = localStorage.getItem('campusserve_theme') || 'midnight';
    return ['midnight', 'aurora', 'violet', 'ember', 'light'].includes(saved) ? saved : 'midnight';
  } catch {
    return 'midnight';
  }
}

function getInitialSession() {
  try {
    const raw = sessionStorage.getItem('campusserve_session');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export default function App() {
  const [theme, setTheme] = useState(getInitialTheme);
  const [session, setSession] = useState(getInitialSession);
  const [activeView, setActiveView] = useState('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const [health, setHealth] = useState(null);
  const [requests, setRequests] = useState([]);
  const [logs, setLogs] = useState([]);
  const [locations, setLocations] = useState([]);
  const [buildings, setBuildings] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [posts, setPosts] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [auditEntries, setAuditEntries] = useState([]);
  const [notifications, setNotifications] = useState([]);

  const [seeding, setSeeding] = useState(false);
  const [globalSearch, setGlobalSearch] = useState('');
  const [trackIdTarget, setTrackIdTarget] = useState('');
  const [prefillLocation, setPrefillLocation] = useState('');
  const [requestsSubTab, setRequestsSubTab] = useState('submit');

  function applyTheme(nextTheme) {
    setTheme(nextTheme);
    document.documentElement.setAttribute('data-theme', nextTheme);
    document.documentElement.setAttribute('data-bs-theme', nextTheme === 'light' ? 'light' : 'dark');
    try {
      localStorage.setItem('campusserve_theme', nextTheme);
    } catch {
      // Ignore storage errors
    }
  }

  const fetchHealth = useCallback(async () => {
    try {
      const res = await fetch('/api/health');
      if (res.ok) setHealth(await res.json());
    } catch {
      setHealth(null);
    }
  }, []);

  const fetchCoreData = useCallback(async () => {
    const refQuery = session?.syntheticId ? `?ref=${encodeURIComponent(session.syntheticId)}` : '';
    const [reqRes, locRes, annRes, postRes, anaRes, audRes, notifRes, logRes] = await Promise.allSettled([
      fetch('/api/requests'),
      fetch('/api/locations'),
      fetch('/api/announcements'),
      fetch('/api/posts'),
      fetch('/api/analytics'),
      fetch('/api/audit'),
      fetch(`/api/notifications${refQuery}`),
      fetch('/api/logs?limit=50'),
    ]);

    if (reqRes.status === 'fulfilled' && reqRes.value.ok) {
      const d = await reqRes.value.json();
      setRequests(d.requests || []);
    }
    if (locRes.status === 'fulfilled' && locRes.value.ok) {
      const d = await locRes.value.json();
      setLocations(d.locations || []);
      setBuildings(d.buildings || []);
    }
    if (annRes.status === 'fulfilled' && annRes.value.ok) {
      const d = await annRes.value.json();
      setAnnouncements(d.announcements || []);
    }
    if (postRes.status === 'fulfilled' && postRes.value.ok) {
      const d = await postRes.value.json();
      setPosts(d.posts || []);
    }
    if (anaRes.status === 'fulfilled' && anaRes.value.ok) {
      setAnalytics(await anaRes.value.json());
    }
    if (audRes.status === 'fulfilled' && audRes.value.ok) {
      const d = await audRes.value.json();
      setAuditEntries(d.entries || []);
    }
    if (notifRes.status === 'fulfilled' && notifRes.value.ok) {
      const d = await notifRes.value.json();
      setNotifications(d.notifications || []);
    }
    if (logRes.status === 'fulfilled' && logRes.value.ok) {
      const d = await logRes.value.json();
      setLogs(d.logs || []);
    }
  }, [session]);

  const refreshAll = useCallback(async () => {
    await Promise.all([fetchHealth(), fetchCoreData()]);
  }, [fetchHealth, fetchCoreData]);

  useEffect(() => {
    refreshAll();
    const timer = setInterval(fetchHealth, 15000);
    return () => clearInterval(timer);
  }, [refreshAll, fetchHealth]);

  function handleAuthenticated(newSession) {
    setSession(newSession);
    try {
      sessionStorage.setItem('campusserve_session', JSON.stringify(newSession));
    } catch {
      // Ignore storage errors
    }
    setActiveView('dashboard');
  }

  function handleLogout() {
    setSession(null);
    setUserMenuOpen(false);
    try {
      sessionStorage.removeItem('campusserve_session');
    } catch {
      // Ignore storage errors
    }
  }

  async function handleSeedDemo() {
    setSeeding(true);
    try {
      const res = await fetch('/api/seed', { method: 'POST' });
      if (res.ok) await refreshAll();
    } finally {
      setSeeding(false);
    }
  }

  function handleTrackRequest(requestId) {
    setTrackIdTarget(requestId);
    setRequestsSubTab('track');
    setActiveView('requests');
  }

  function handleReportAtLocation(locationText) {
    setPrefillLocation(locationText);
    setRequestsSubTab('submit');
    setActiveView('requests');
  }

  async function handleQuickTransition(requestId, nextStatus) {
    const res = await fetch(`/api/requests/${encodeURIComponent(requestId)}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: nextStatus,
        changedBy: session?.syntheticId || 'service-desk',
      }),
    });
    if (res.ok) {
      await refreshAll();
    }
  }

  function handleNavigate(view) {
    setActiveView(view);
    setMobileMenuOpen(false);
    setUserMenuOpen(false);
    if (view === 'cloud') fetchCoreData();
  }

  if (!session) {
    return (
      <AuthScreen
        theme={theme}
        onChangeTheme={applyTheme}
        health={health}
        onAuthenticated={handleAuthenticated}
      />
    );
  }

  const isConnected = health?.status === 'ok';
  const fsStatus = health?.services?.firestore?.status || 'connecting';
  const logStatus = health?.services?.logging?.status || 'connecting';

  const navGroups =
    session.role === 'admin'
      ? [
          {
            label: 'Oversight',
            items: [
              { id: 'dashboard', icon: 'bi-speedometer2', label: 'Admin Dashboard' },
              { id: 'requests', icon: 'bi-exclamation-diamond', label: 'Requests & Console' },
              { id: 'routing', icon: 'bi-diagram-3', label: 'Sector Routing' },
            ],
          },
          {
            label: 'Community',
            items: [
              { id: 'posts', icon: 'bi-chat-square-text', label: 'Campus Posts' },
              { id: 'decisions', icon: 'bi-check2-square', label: 'Decisions' },
              { id: 'announcements', icon: 'bi-megaphone', label: 'Announcements' },
              { id: 'notifications', icon: 'bi-bell', label: 'Notifications', badge: notifications.length || null },
            ],
          },
          {
            label: 'Insights & Cloud',
            items: [
              { id: 'analytics', icon: 'bi-graph-up-arrow', label: 'Analytics' },
              { id: 'audit', icon: 'bi-journal-check', label: 'Audit Log' },
              { id: 'campusbot', icon: 'bi-robot', label: 'CampusBot' },
              { id: 'locations', icon: 'bi-geo-alt', label: 'Campus Directory' },
              { id: 'cloud', icon: 'bi-shield-check', label: 'Logs & Cloud Verify' },
            ],
          },
        ]
      : session.role === 'faculty'
      ? [
          {
            label: 'Department',
            items: [
              { id: 'dashboard', icon: 'bi-grid-1x2', label: 'Workspace Home' },
              { id: 'requests', icon: 'bi-exclamation-diamond', label: 'Requests & Console' },
              { id: 'announcements', icon: 'bi-megaphone', label: 'Announcements' },
            ],
          },
          {
            label: 'Campus',
            items: [
              { id: 'posts', icon: 'bi-chat-square-text', label: 'Campus Posts' },
              { id: 'decisions', icon: 'bi-check2-square', label: 'Campus Decisions' },
              { id: 'notifications', icon: 'bi-bell', label: 'Notifications', badge: notifications.length || null },
              { id: 'campusbot', icon: 'bi-robot', label: 'CampusBot' },
              { id: 'locations', icon: 'bi-geo-alt', label: 'Campus Directory' },
            ],
          },
          {
            label: 'Verification',
            items: [
              { id: 'cloud', icon: 'bi-shield-check', label: 'Logs & Cloud Verify' },
              { id: 'profile', icon: 'bi-person-badge', label: 'Profile' },
            ],
          },
        ]
      : [
          {
            label: 'Workspace',
            items: [
              { id: 'dashboard', icon: 'bi-grid-1x2', label: 'Home' },
              { id: 'requests', icon: 'bi-exclamation-diamond', label: 'Requests & Track' },
              { id: 'posts', icon: 'bi-chat-square-text', label: 'Campus Posts' },
              { id: 'decisions', icon: 'bi-check2-square', label: 'Campus Decisions' },
              { id: 'notifications', icon: 'bi-bell', label: 'Notifications', badge: notifications.length || null },
            ],
          },
          {
            label: 'Discover & Verify',
            items: [
              { id: 'campusbot', icon: 'bi-robot', label: 'CampusBot' },
              { id: 'locations', icon: 'bi-geo-alt', label: 'Campus Directory' },
              { id: 'announcements', icon: 'bi-megaphone', label: 'Announcements' },
              { id: 'profile', icon: 'bi-person-badge', label: 'Profile' },
              { id: 'cloud', icon: 'bi-shield-check', label: 'Logs & Cloud Verify' },
            ],
          },
        ];

  return (
    <div className="app-shell">
      {/* Desktop Sidebar */}
      <aside className="sidebar" aria-label="Main navigation">
        <div
          onClick={() => handleNavigate('dashboard')}
          className="brand cursor-pointer"
        >
          <span className="brand-mark">
            <i className="bi bi-mortarboard-fill" />
          </span>
          <span>
            <span className="brand-name">CampusServe</span>
            <span className="brand-sub">BMSCE Workspace</span>
          </span>
        </div>

        <div className="sidebar-inner">
          {navGroups.map((group) => (
            <div key={group.label} className="nav-group">
              <div className="nav-label">{group.label}</div>
              {group.items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleNavigate(item.id)}
                  className={`nav-link-cs ${activeView === item.id ? 'active' : ''}`}
                >
                  <i className={`bi ${item.icon}`} />
                  <span>{item.label}</span>
                  {item.badge ? <span className="nav-badge-cs">{item.badge}</span> : null}
                </button>
              ))}
            </div>
          ))}
        </div>

        <div className="support-card">
          <div className="flex items-start gap-2">
            <i className="bi bi-shield-check cs-brand text-base" />
            <div>
              <strong className="block cs-txt text-xs mb-0.5">Transparent by design</strong>
              <span className="text-[11px] leading-snug block">
                Synthetic Lab Mode on Floci GCP (<code className="font-mono">localhost:4588</code>). Zero PII logged.
              </span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Column */}
      <div className="app-main">
        {/* Topbar */}
        <header className="topbar">
          <div className="flex items-center gap-3 max-w-[1480px] mx-auto flex-wrap">
            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              className="icon-btn lg:hidden"
              aria-label="Toggle navigation"
            >
              <i className="bi bi-list" />
            </button>

            <div className="hidden xl:block leading-tight">
              <div className="text-sm font-bold">CampusServe</div>
              <div className="text-[11px] cs-muted">{getGreeting()}, {session.displayLabel}</div>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (globalSearch.trim()) {
                  handleTrackRequest(globalSearch.trim());
                  setGlobalSearch('');
                }
              }}
              className="searchbox-cs hidden sm:block"
            >
              <i className="bi bi-search" />
              <input
                type="search"
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                placeholder="Track REQ-... ID or jump..."
              />
            </form>

            <div className="flex items-center gap-2 ml-auto flex-wrap">
              {/* Floci Live Status Pill */}
              <div
                onClick={() => handleNavigate('cloud')}
                className={`hidden md:inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-[11px] font-semibold cursor-pointer ${
                  isConnected ? 'badge-resolved' : 'badge-overdue'
                }`}
                title="Click to inspect Cloud & Privacy Verification"
              >
                <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
                <span>
                  {isConnected ? 'Floci GCP Connected • localhost:4588' : 'Backend Disconnected'}
                </span>
                {isConnected && (
                  <span className="opacity-85 font-mono hidden xl:inline">
                    (FS: {fsStatus} • Log: {logStatus})
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={handleSeedDemo}
                disabled={seeding}
                className="btn-cs btn-cs-secondary btn-cs-sm"
              >
                <i className="bi bi-stars" />
                {seeding ? 'Seeding...' : 'Seed Synthetic Demo Data'}
              </button>

              <ThemePicker theme={theme} onChangeTheme={applyTheme} />

              <button
                type="button"
                onClick={() => handleNavigate('notifications')}
                className="icon-btn"
                aria-label="Notifications"
                title="Notifications"
              >
                <i className="bi bi-bell" />
                {notifications.length > 0 && <span className="badge-dot">{notifications.length}</span>}
              </button>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setUserMenuOpen((o) => !o)}
                  className="user-chip"
                >
                  <span className="avatar">{session.syntheticId.slice(0, 3)}</span>
                  <span className="hidden md:block text-left leading-tight">
                    <strong className="block text-xs">{session.syntheticId}</strong>
                    <span className="block text-[10px] cs-muted capitalize">{session.role}</span>
                  </span>
                  <i className="bi bi-chevron-down text-[11px] cs-muted" />
                </button>

                {userMenuOpen && (
                  <div className="theme-menu absolute right-0 mt-2 z-50" style={{ minWidth: 220 }}>
                    <div className="px-3 py-2 border-b cs-border mb-1">
                      <div className="text-xs font-bold">{session.displayLabel}</div>
                      <div className="text-[11px] cs-muted">{session.department}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleNavigate('profile')}
                      className="theme-option text-xs"
                    >
                      <i className="bi bi-person" />
                      <span>Synthetic Profile</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleNavigate('cloud')}
                      className="theme-option text-xs"
                    >
                      <i className="bi bi-shield-check" />
                      <span>Cloud Verification</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="theme-option text-xs text-rose-400"
                    >
                      <i className="bi bi-box-arrow-right" />
                      <span>Switch Role / Sign Out</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Mobile Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden glass-card mx-4 mt-3 p-4 space-y-2">
            {navGroups.flatMap((g) => g.items).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavigate(item.id)}
                className={`nav-link-cs ${activeView === item.id ? 'active' : ''}`}
              >
                <i className={`bi ${item.icon}`} />
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        )}

        {/* Active View */}
        <main className="content">
          {activeView === 'dashboard' &&
            (session.role === 'admin' ? (
              <AdminDashboard
                requests={requests}
                analytics={analytics}
                onNavigate={handleNavigate}
                onTrackRequest={handleTrackRequest}
                onTransition={handleQuickTransition}
              />
            ) : (
              <StudentDashboard
                session={session}
                requests={requests}
                announcements={announcements}
                posts={posts}
                locations={locations}
                onNavigate={handleNavigate}
                onTrackRequest={handleTrackRequest}
                onRefreshAll={refreshAll}
              />
            ))}

          {activeView === 'requests' && (
            <RequestsWorkspace
              session={session}
              requests={requests}
              locations={locations}
              initialSubTab={requestsSubTab}
              initialTrackId={trackIdTarget}
              initialLocation={prefillLocation}
              onRefreshAll={refreshAll}
            />
          )}

          {activeView === 'routing' && (
            <SectorRoutingView
              requests={requests}
              onTransition={handleQuickTransition}
              onTrackRequest={handleTrackRequest}
            />
          )}

          {activeView === 'locations' && (
            <LocationsView
              locations={locations}
              buildings={buildings}
              onReportAtLocation={handleReportAtLocation}
            />
          )}

          {activeView === 'announcements' && (
            <AnnouncementsView
              session={session}
              announcements={announcements}
              onRefreshAll={refreshAll}
            />
          )}

          {activeView === 'posts' && (
            <PostsView
              session={session}
              posts={posts}
              onRefreshAll={refreshAll}
            />
          )}

          {activeView === 'decisions' && (
            <DecisionsView
              session={session}
              posts={posts}
              onRefreshAll={refreshAll}
            />
          )}

          {activeView === 'campusbot' && (
            <CampusBotView
              requests={requests}
              onNavigate={handleNavigate}
              onTrackRequest={handleTrackRequest}
            />
          )}

          {activeView === 'analytics' && (
            <AnalyticsView analytics={analytics} onNavigate={handleNavigate} />
          )}

          {activeView === 'audit' && (
            <AuditView auditEntries={auditEntries} onTrackRequest={handleTrackRequest} />
          )}

          {activeView === 'notifications' && (
            <NotificationsView notifications={notifications} onTrackRequest={handleTrackRequest} />
          )}

          {activeView === 'profile' && (
            <ProfileView
              session={session}
              requests={requests}
              onNavigate={handleNavigate}
              onTrackRequest={handleTrackRequest}
              onLogout={handleLogout}
            />
          )}

          {activeView === 'cloud' && (
            <CloudVerificationView
              health={health}
              logs={logs}
              onRefreshLogs={refreshAll}
            />
          )}
        </main>

        <footer className="border-t cs-border px-6 py-4 text-xs cs-muted flex flex-wrap justify-between gap-2">
          <span>CampusServe · BMSCE Cloud Service Desk · Synthetic Lab Mode</span>
          <div className="flex gap-4">
            <button type="button" onClick={() => handleNavigate('cloud')} className="bg-transparent border-0 cs-muted hover:cs-brand cursor-pointer">
              Cloud &amp; Privacy Status
            </button>
            <button type="button" onClick={() => handleNavigate('campusbot')} className="bg-transparent border-0 cs-muted hover:cs-brand cursor-pointer">
              CampusBot Help
            </button>
          </div>
        </footer>
      </div>

      {/* Mobile Bottom Nav */}
      <nav className="bottom-nav" aria-label="Quick mobile navigation">
        {[
          { id: 'dashboard', icon: 'bi-house', label: 'Home' },
          { id: 'requests', icon: 'bi-exclamation-diamond', label: 'Requests' },
          { id: 'posts', icon: 'bi-chat-square-text', label: 'Posts' },
          { id: 'campusbot', icon: 'bi-robot', label: 'Bot' },
          { id: 'cloud', icon: 'bi-shield-check', label: 'Cloud' },
        ].map((b) => (
          <button
            key={b.id}
            type="button"
            onClick={() => handleNavigate(b.id)}
            className={activeView === b.id ? 'active' : ''}
          >
            <i className={`bi ${b.icon} text-base`} />
            <span>{b.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
