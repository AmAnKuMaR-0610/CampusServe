import { useState } from 'react';
import { POST_CATEGORIES, REACTION_EMOJIS, formatTimestamp } from '../constants.js';
import { StatusBadge } from './StatusBadge.jsx';

export function AnnouncementsView({ session, announcements, onRefreshAll }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [err, setErr] = useState('');
  const [posting, setPosting] = useState(false);

  const canPublish = session?.role === 'faculty' || session?.role === 'admin';

  async function handlePublish(e) {
    e.preventDefault();
    setErr('');
    setPosting(true);
    try {
      const res = await fetch('/api/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          publishedBy: session.displayLabel,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error || 'Failed to publish notice');
        return;
      }
      setTitle('');
      setDescription('');
      await onRefreshAll();
    } catch {
      setErr('Network error while publishing announcement.');
    } finally {
      setPosting(false);
    }
  }

  return (
    <div className="space-y-5">
      <section className="page-head">
        <div>
          <div className="eyebrow">Official Notice Board</div>
          <h1 className="page-title">Campus Announcements</h1>
          <p className="page-sub">Verified service notices from synthetic faculty &amp; administration accounts.</p>
        </div>
        <span className="badge-status badge-assigned">
          <i className="bi bi-patch-check" />
          {announcements.length} notices
        </span>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {canPublish && (
          <div className="lg:col-span-4 glass-card p-5">
            <h2 className="text-base font-bold mb-1">Publish Official Notice</h2>
            <p className="text-xs cs-muted mb-4">Visible immediately across Student and Staff dashboards.</p>
            {err && (
              <div className="mb-3 rounded-xl border border-rose-400/40 bg-rose-500/15 px-3 py-2 text-xs text-rose-200">
                {err}
              </div>
            )}
            <form onSubmit={handlePublish} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold cs-secondary mb-1">Title</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Library Wi-Fi maintenance window"
                  className="cs-input"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold cs-secondary mb-1">Notice Body</label>
                <textarea
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Dates, affected blocks, and support desk notes..."
                  className="cs-textarea"
                  required
                />
              </div>
              <button type="submit" disabled={posting} className="btn-cs btn-cs-primary w-full">
                <i className="bi bi-megaphone" />
                {posting ? 'Publishing...' : 'Publish Notice'}
              </button>
            </form>
          </div>
        )}

        <div className={`${canPublish ? 'lg:col-span-8' : 'lg:col-span-12'} glass-card p-5 space-y-4`}>
          <h2 className="text-base font-bold">Published Notices</h2>
          {announcements.map((a) => (
            <article key={a.id} className="pb-4 border-b cs-border last:border-b-0 last:pb-0">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h3 className="text-sm font-bold">{a.title}</h3>
                <span className="text-xs font-mono cs-muted">{formatTimestamp(a.createdAt)}</span>
              </div>
              <p className="text-sm cs-secondary mt-1.5 leading-relaxed">{a.description}</p>
              <span className="badge-status badge-submitted mt-2">
                <i className="bi bi-person-badge" />
                {a.publishedBy}
              </span>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}

export function PostsView({ session, posts, onRefreshAll }) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState(POST_CATEGORIES[0]);
  const [body, setBody] = useState('');
  const [err, setErr] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [selectedPost, setSelectedPost] = useState(null);

  const feedPosts = posts.filter((p) => p.kind !== 'decision');

  async function handleCreatePost(e) {
    e.preventDefault();
    setErr('');
    setSubmitting(true);
    try {
      const res = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'post',
          title,
          category,
          body,
          authorRef: session.syntheticId,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error || 'Failed to publish post');
        return;
      }
      setTitle('');
      setBody('');
      await onRefreshAll();
    } catch {
      setErr('Network error while publishing post.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleVoteOrReact(postId, emoji = null) {
    const res = await fetch(`/api/posts/${encodeURIComponent(postId)}/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        voterRef: session.syntheticId,
        ...(emoji ? { emoji } : {}),
      }),
    });
    if (res.ok) {
      const data = await res.json();
      if (selectedPost?.id === postId) setSelectedPost(data.post);
      await onRefreshAll();
    }
  }

  if (selectedPost) {
    return (
      <div className="space-y-5">
        <button type="button" onClick={() => setSelectedPost(null)} className="btn-cs btn-cs-ghost btn-cs-sm">
          <i className="bi bi-arrow-left" />
          Back to Campus Feed
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-8 glass-card p-6 space-y-4">
            <div className="flex items-center gap-3">
              <span className="avatar">{selectedPost.authorRef?.slice(0, 3) || 'STU'}</span>
              <div>
                <div className="text-sm font-bold">{selectedPost.authorLabel}</div>
                <div className="text-xs cs-muted">{selectedPost.category} · {formatTimestamp(selectedPost.createdAt)}</div>
              </div>
            </div>
            <h1 className="page-title">{selectedPost.title}</h1>
            <p className="text-sm cs-secondary whitespace-pre-line leading-relaxed">{selectedPost.body}</p>
            <div className="flex flex-wrap items-center gap-2 pt-3 border-t cs-border">
              <button
                type="button"
                onClick={() => handleVoteOrReact(selectedPost.id)}
                className="btn-cs btn-cs-secondary btn-cs-sm"
              >
                <i className="bi bi-arrow-up-circle" />
                Upvote · {selectedPost.upvotes || 0}
              </button>
              {REACTION_EMOJIS.map((em) => (
                <button
                  key={em}
                  type="button"
                  onClick={() => handleVoteOrReact(selectedPost.id, em)}
                  className="btn-cs btn-cs-ghost btn-cs-sm"
                >
                  {em} {selectedPost.reactions?.[em] ? selectedPost.reactions[em] : ''}
                </button>
              ))}
            </div>
          </div>

          <div className="lg:col-span-4 glass-card p-5 space-y-2 text-xs">
            <h3 className="text-sm font-bold mb-2">Post Metadata</h3>
            <div className="flex justify-between py-1 border-b cs-border">
              <span className="cs-muted">Author Ref</span>
              <span className="font-mono font-semibold">{selectedPost.authorRef}</span>
            </div>
            <div className="flex justify-between py-1 border-b cs-border">
              <span className="cs-muted">Category</span>
              <span className="font-semibold">{selectedPost.category}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="cs-muted">Upvotes</span>
              <span className="font-semibold">{selectedPost.upvotes || 0}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section className="page-head">
        <div>
          <div className="eyebrow">Community Feed</div>
          <h1 className="page-title">Campus Posts</h1>
          <p className="page-sub">Share study spots, club updates, and verified campus infrastructure wins using synthetic profiles.</p>
        </div>
        <span className="badge-status badge-submitted">{feedPosts.length} posts</span>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        <div className="lg:col-span-4 glass-card p-5">
          <h2 className="text-base font-bold mb-1">Create a Post</h2>
          <p className="text-xs cs-muted mb-3">Posted as {session.displayLabel}. Never include real student PII.</p>
          {err && (
            <div className="mb-3 rounded-xl border border-rose-400/40 bg-rose-500/15 px-3 py-2 text-xs text-rose-200">
              {err}
            </div>
          )}
          <form onSubmit={handleCreatePost} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold cs-secondary mb-1">Headline</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Give your post a title" className="cs-input" required />
            </div>
            <div>
              <label className="block text-xs font-semibold cs-secondary mb-1">Category</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="cs-select">
                {POST_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold cs-secondary mb-1">Body</label>
              <textarea rows={4} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write your campus update..." className="cs-textarea" required />
            </div>
            <button type="submit" disabled={submitting} className="btn-cs btn-cs-primary w-full">
              <i className="bi bi-send" />
              {submitting ? 'Publishing...' : 'Publish Post'}
            </button>
          </form>
        </div>

        <div className="lg:col-span-8 space-y-4">
          {feedPosts.map((p) => (
            <article key={p.id} className="glass-card p-5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span className="avatar">{p.authorRef?.slice(0, 3) || 'STU'}</span>
                  <div>
                    <div className="text-sm font-bold flex items-center gap-2">
                      {p.authorLabel}
                      {p.authorRole !== 'student' && (
                        <span className="badge-status badge-assigned">Official</span>
                      )}
                    </div>
                    <div className="text-xs cs-muted">{p.category} · {formatTimestamp(p.createdAt)}</div>
                  </div>
                </div>
                {p.isPinned && <span className="badge-status badge-upcoming">Pinned</span>}
              </div>

              <h3
                onClick={() => setSelectedPost(p)}
                className="text-base font-bold cursor-pointer hover:underline"
              >
                {p.title}
              </h3>
              <p className="text-sm cs-secondary leading-relaxed">{p.body}</p>

              <div className="flex flex-wrap items-center gap-2 pt-2.5 border-t cs-border">
                <button
                  type="button"
                  onClick={() => handleVoteOrReact(p.id)}
                  className={`btn-cs btn-cs-sm ${
                    (p.voterRefs || []).includes(session.syntheticId) ? 'btn-cs-primary' : 'btn-cs-secondary'
                  }`}
                >
                  <i className="bi bi-arrow-up-circle" />
                  {p.upvotes || 0}
                </button>
                {REACTION_EMOJIS.map((em) => (
                  <button
                    key={em}
                    type="button"
                    onClick={() => handleVoteOrReact(p.id, em)}
                    className="btn-cs btn-cs-ghost btn-cs-sm"
                  >
                    {em} {p.reactions?.[em] ? p.reactions[em] : ''}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setSelectedPost(p)}
                  className="btn-cs btn-cs-ghost btn-cs-sm ml-auto"
                >
                  Open detail →
                </button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}

export function DecisionsView({ session, posts, onRefreshAll }) {
  const [selected, setSelected] = useState(null);
  const [choiceId, setChoiceId] = useState('');
  const [receipt, setReceipt] = useState('');
  const [voteErr, setVoteErr] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newBody, setNewBody] = useState('');
  const [newOptions, setNewOptions] = useState('Approve proposal|Request revision|Defer');

  const decisions = posts.filter((p) => p.kind === 'decision');
  const activeDecision = selected ? decisions.find((d) => d.id === selected.id) || selected : null;

  async function handleCastBallot(e) {
    e.preventDefault();
    if (!activeDecision || !choiceId) return;
    setVoteErr('');
    const res = await fetch(`/api/posts/${encodeURIComponent(activeDecision.id)}/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        voterRef: session.syntheticId,
        optionId: choiceId,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setVoteErr(data.error || 'Could not cast vote');
      return;
    }
    setReceipt(data.receipt || '');
    setSelected(data.post);
    await onRefreshAll();
  }

  async function handleCreateProposal(e) {
    e.preventDefault();
    const opts = newOptions.split('|').map((s) => s.trim()).filter(Boolean);
    const res = await fetch('/api/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kind: 'decision',
        title: newTitle,
        body: newBody,
        options: opts,
        authorRef: session.syntheticId,
      }),
    });
    if (res.ok) {
      setNewTitle('');
      setNewBody('');
      await onRefreshAll();
    }
  }

  if (activeDecision) {
    const totalOptionVotes = Math.max(
      1,
      (activeDecision.options || []).reduce((acc, o) => acc + (o.votes || 0), 0),
    );
    return (
      <div className="space-y-5">
        <button
          type="button"
          onClick={() => {
            setSelected(null);
            setVoteErr('');
            setReceipt('');
            setChoiceId('');
          }}
          className="btn-cs btn-cs-ghost btn-cs-sm"
        >
          <i className="bi bi-arrow-left" />
          Back to Campus Decisions
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-8 space-y-5">
            <div className="glass-card p-6 space-y-4">
              <div className="flex items-center gap-2 flex-wrap">
                <StatusBadge status={activeDecision.status} />
                <span className="badge-status badge-submitted">
                  <i className="bi bi-incognito" />
                  Anonymous SHA-256 Ballot
                </span>
              </div>
              <h1 className="page-title">{activeDecision.title}</h1>
              <p className="text-sm cs-secondary leading-relaxed">{activeDecision.body}</p>
              {activeDecision.aiSummary && (
                <div className="rounded-xl border cs-border bg-[rgba(122,170,255,0.06)] p-3.5 text-xs cs-secondary">
                  <strong className="cs-brand block mb-1">Summary</strong>
                  {activeDecision.aiSummary}
                </div>
              )}
            </div>

            {activeDecision.status === 'Active' && (
              <div className="glass-card p-6 space-y-3">
                <h2 className="text-base font-bold">Cast Synthetic Ballot</h2>
                {voteErr && (
                  <div className="rounded-xl border border-rose-400/40 bg-rose-500/15 px-3 py-2 text-xs text-rose-200">
                    {voteErr}
                  </div>
                )}
                {receipt && (
                  <div className="rounded-xl border border-emerald-400/40 bg-emerald-500/15 p-3.5 text-xs">
                    <div className="font-bold mb-1">Ballot Recorded — Verification Receipt:</div>
                    <code className="font-mono text-base font-bold tracking-widest cs-brand">{receipt}</code>
                  </div>
                )}
                <form onSubmit={handleCastBallot} className="space-y-2.5">
                  {(activeDecision.options || []).map((opt) => (
                    <label
                      key={opt.id}
                      className="flex items-center gap-3 p-3 rounded-xl border cs-border hover:border-[var(--glass-border-strong)] cursor-pointer"
                    >
                      <input
                        type="radio"
                        name="decisionOption"
                        value={opt.id}
                        checked={choiceId === opt.id}
                        onChange={() => setChoiceId(opt.id)}
                        required
                      />
                      <span className="text-sm font-semibold">{opt.label}</span>
                    </label>
                  ))}
                  <button type="submit" className="btn-cs btn-cs-primary mt-2">
                    <i className="bi bi-check2-circle" />
                    Submit Anonymous Vote
                  </button>
                </form>
              </div>
            )}

            <div className="glass-card p-6 space-y-3">
              <h2 className="text-base font-bold">Current Tally</h2>
              {(activeDecision.options || []).map((opt) => {
                const pct = Math.round(((opt.votes || 0) / totalOptionVotes) * 100);
                return (
                  <div key={opt.id}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-semibold">{opt.label}</span>
                      <span className="cs-muted">{opt.votes || 0} votes · {pct}%</span>
                    </div>
                    <div className="progress-cs">
                      <div className="progress-bar-cs" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="lg:col-span-4 glass-card p-5 space-y-3 text-xs cs-secondary h-fit">
            <h3 className="text-sm font-bold cs-txt">How Anonymous Voting Works</h3>
            <p>1. Your synthetic ID is one-way hashed with the proposal ID so no duplicate votes occur.</p>
            <p>2. A 12-character verification receipt is returned immediately.</p>
            <p>3. Only aggregate option counts are persisted and displayed.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="page-head">
        <div>
          <div className="eyebrow">Decide Together</div>
          <h1 className="page-title">Campus Decisions</h1>
          <p className="page-sub">Administrative proposals decided by anonymous synthetic ballot and tracked through implementation.</p>
        </div>
        <span className="badge-status badge-active">
          <i className="bi bi-shield-check" />
          Anonymous &amp; Verifiable
        </span>
      </section>

      {session.role === 'admin' && (
        <div className="glass-card p-5">
          <h2 className="text-base font-bold mb-3">Open New Campus Proposal</h2>
          <form onSubmit={handleCreateProposal} className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Proposal title" className="cs-input" required />
            <input value={newOptions} onChange={(e) => setNewOptions(e.target.value)} placeholder="Options separated by |" className="cs-input" required />
            <textarea rows={2} value={newBody} onChange={(e) => setNewBody(e.target.value)} placeholder="Proposal description..." className="cs-textarea md:col-span-2" required />
            <div className="md:col-span-2 flex justify-end">
              <button type="submit" className="btn-cs btn-cs-primary btn-cs-sm">Create Active Proposal</button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {decisions.map((d) => (
          <div
            key={d.id}
            onClick={() => setSelected(d)}
            className="glass-card p-5 cursor-pointer hover:border-[var(--glass-border-strong)] space-y-3"
          >
            <div className="flex items-center justify-between gap-2">
              <StatusBadge status={d.status} />
              <span className="text-xs cs-muted">{d.upvotes || 0} votes</span>
            </div>
            <h3 className="text-base font-bold">{d.title}</h3>
            <p className="text-xs cs-secondary line-clamp-2">{d.body}</p>
            <div className="flex items-center justify-between text-xs cs-muted pt-2 border-t cs-border">
              <span>By {d.authorLabel}</span>
              <span className="cs-brand font-semibold">Open ballot →</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
