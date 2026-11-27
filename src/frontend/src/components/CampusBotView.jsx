import { useState } from 'react';

const PROMPT_CHIPS = [
  'Report an issue',
  'Which department handles it?',
  'Status lifecycle rules',
  'SLA timer',
  'Campus decisions & voting',
  'Find a room or lab',
  'Privacy & logging',
];

export function CampusBotView({ requests, onNavigate, onTrackRequest }) {
  const [messages, setMessages] = useState([
    {
      sender: 'bot',
      text: "Hi! I'm CampusBot. Ask me how to submit a ticket, which BMSCE department handles an issue, status transition rules, or paste any REQ-... ID for an instant lookup.",
    },
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);

  async function sendMessage(text) {
    const clean = String(text || '').trim();
    if (!clean) return;
    setMessages((prev) => [...prev, { sender: 'user', text: clean }]);
    setInput('');
    setSending(true);

    try {
      const res = await fetch('/api/campusbot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: clean }),
      });
      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        {
          sender: 'bot',
          text: data.reply || data.error || 'Unable to process query.',
          ticket: data.ticket || null,
          suggestedCategory: data.suggestedCategory,
          suggestedDepartment: data.suggestedDepartment,
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { sender: 'bot', text: 'Could not reach /api/campusbot on port 4000.' },
      ]);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-5">
      <section className="page-head">
        <div>
          <div className="eyebrow">Instant Answers</div>
          <h1 className="page-title">CampusBot Assistant</h1>
          <p className="page-sub">Rule-based assistant for BMSCE department routing, lifecycle rules, and instant REQ- ticket lookups.</p>
        </div>
        <span className="badge-status badge-active">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          Online
        </span>
      </section>

      <div className="bot-shell">
        <div className="glass-card overflow-hidden flex flex-col">
          <div className="px-5 py-3.5 border-b cs-border flex items-center gap-3">
            <span className="avatar"><i className="bi bi-robot" /></span>
            <div>
              <div className="text-sm font-bold">CampusBot</div>
              <div className="text-xs cs-muted">Zero-PII rule-based helper · backed by Firestore lookup</div>
            </div>
          </div>

          <div className="bot-thread">
            {messages.map((m, idx) => (
              <div key={idx} className={`bot-bubble ${m.sender === 'user' ? 'mine' : ''}`}>
                <span className="block text-[10px] uppercase tracking-wider font-bold opacity-75 mb-1">
                  {m.sender === 'user' ? 'You' : 'CampusBot'}
                </span>
                <div>{m.text}</div>
                {m.ticket && (
                  <div className="mt-2 pt-2 border-t cs-border flex items-center justify-between gap-2 text-xs">
                    <span className="font-mono font-bold">{m.ticket.requestId}</span>
                    <button
                      type="button"
                      onClick={() => onTrackRequest(m.ticket.requestId)}
                      className="btn-cs btn-cs-secondary btn-cs-sm"
                    >
                      Open Stepper →
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="px-4 pb-3 flex flex-wrap gap-1.5">
            {PROMPT_CHIPS.map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => sendMessage(chip)}
                className="btn-cs btn-cs-secondary btn-cs-sm"
              >
                {chip}
              </button>
            ))}
            {requests[0] && (
              <button
                type="button"
                onClick={() => sendMessage(`Check status of ${requests[0].requestId}`)}
                className="btn-cs btn-cs-ghost btn-cs-sm font-mono"
              >
                Lookup {requests[0].requestId}
              </button>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendMessage(input);
            }}
            className="p-3.5 border-t cs-border flex gap-2"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask CampusBot or paste a REQ-... ticket ID..."
              className="cs-input flex-1"
            />
            <button type="submit" disabled={sending || !input.trim()} className="btn-cs btn-cs-primary">
              <i className="bi bi-send" />
            </button>
          </form>
        </div>

        <div className="space-y-4">
          <div className="glass-card p-4 space-y-2.5">
            <h2 className="text-sm font-bold">Quick Shortcuts</h2>
            <button type="button" onClick={() => onNavigate('requests')} className="command-tile">
              <span className="ci"><i className="bi bi-plus-circle" /></span>
              <span><strong className="block text-xs">Submit &amp; Track</strong><span className="text-[11px] cs-muted">Create or inspect REQ- IDs</span></span>
            </button>
            <button type="button" onClick={() => onNavigate('locations')} className="command-tile">
              <span className="ci"><i className="bi bi-geo-alt" /></span>
              <span><strong className="block text-xs">Campus Directory</strong><span className="text-[11px] cs-muted">24 BMSCE rooms &amp; labs</span></span>
            </button>
            <button type="button" onClick={() => onNavigate('decisions')} className="command-tile">
              <span className="ci"><i className="bi bi-check2-square" /></span>
              <span><strong className="block text-xs">Campus Decisions</strong><span className="text-[11px] cs-muted">Anonymous proposals</span></span>
            </button>
          </div>
          <div className="glass-card p-4 text-xs cs-secondary">
            <i className="bi bi-shield-check cs-brand mr-1.5" />
            CampusBot never logs chat prompts to Cloud Logging and does not store personal data.
          </div>
        </div>
      </div>
    </div>
  );
}
