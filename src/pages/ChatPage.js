import React, { useState, useRef, useEffect } from 'react';
import { callClaude } from '../lib/claude';
import { saveChatSession } from '../lib/supabase';
import './ChatPage.css';

const QUICK_ACTIONS = [
  { label: 'Full EVP briefing', prompt: 'Give me the 5-minute EVP briefing on fleet performance Jan-Jun 2026. Performance numbers, what is working, what is not, vessels to watch, decisions needed.' },
  { label: 'Decisions needed', prompt: 'What are the decisions only the EVP can make today? Frame each as: Gap / Current state / Cost of not fixing / Recommended fix / Owner.' },
  { label: 'OCEAN GALAXY status', prompt: 'Full briefing on OCEAN GALAXY — all flags, detainable deficiencies, release condition, what needs to happen today, who owns each action.' },
  { label: 'Detention trend', prompt: 'Is the detention rate actually improving? Give me the honest answer with the monthly data and explain why.' },
  { label: '8 structural gaps', prompt: 'Walk me through all 8 structural gaps. Which require EVP decision, which are process, which are resource?' },
  { label: 'May 2026 summary', prompt: 'Give me a summary of May 2026 detentions — all vessels, key findings, worst cases, what is still open.' },
  { label: 'Team performance', prompt: 'Orlando Brown has 28% of cases open. Vadym Shylov has 11%. Is this a performance issue or capacity issue? What should I do?' },
  { label: 'Biggest impact change', prompt: 'What is the single change with the biggest impact on reducing detentions? Be specific and honest.' },
];

const HINT_CHIPS = [
  'Is the detention rate improving or worsening?',
  'How did ANDREAS K get detained twice after actions were completed?',
  'Why is ALICIA still on the registry after 5 detentions?',
  'What happened to the 72 vessels with no PDAIP analysis?',
  'KR surveyed OCEAN GALAXY 26 days before and found nothing — what does that say?',
];

function renderText(text) {
  return text
    .replace(/\[WHISTLEBLOWER\]/g, '<span class="flag flag-red">[WHISTLEBLOWER]</span>')
    .replace(/\[FRAUDULENT RECORD[^\]]*\]/g, '<span class="flag flag-red">[FRAUDULENT RECORD]</span>')
    .replace(/\[REPEAT[^\]]*\]/g, '<span class="flag flag-red">[REPEAT DETAINEE]</span>')
    .replace(/\[RO SURVEY GAP\]/g, '<span class="flag flag-amber">[RO SURVEY GAP]</span>')
    .replace(/\[HRS[^\]]*\]/g, '<span class="flag flag-amber">[HRS STATUS]</span>')
    .replace(/\[([A-Z][A-Z _-]+)\]/g, '<span class="flag flag-accent">[$1]</span>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/^### (.+)$/gm, '<div class="msg-h3">$1</div>')
    .replace(/^## (.+)$/gm, '<div class="msg-h2">$1</div>')
    .replace(/^- (.+)$/gm, '<div class="msg-li"><span class="msg-bullet">—</span><span>$1</span></div>')
    .replace(/^(\d+)\. (.+)$/gm, '<div class="msg-li"><span class="msg-num mono accent">$1.</span><span>$2</span></div>')
    .replace(/\n\n/g, '<div class="msg-gap"></div>')
    .replace(/\n/g, '<br>');
}

export default function ChatPage() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState('evp');
  const [sessionId] = useState(() => crypto.randomUUID());
  const messagesEndRef = useRef(null);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  async function send(text) {
    const q = (text || input).trim();
    if (!q || loading) return;
    setInput('');
    const modePrefix = mode === 'evp' ? '[EVP MODE] ' : '[OPERATIONAL MODE] ';
    setMessages(prev => [...prev, { id: Date.now(), role: 'user', text: q }]);
    setLoading(true);
    const assistantId = Date.now() + 1;
    setMessages(prev => [...prev, { id: assistantId, role: 'assistant', text: '', streaming: true }]);
    try {
      const history = messages.map(m => ({ role: m.role, content: m.text }));
      await callClaude(
        [...history, { role: 'user', content: modePrefix + q }],
        (partial) => { setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, text: partial } : m)); }
      );
      setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, streaming: false } : m));
      saveChatSession({ id: sessionId, session_name: q.slice(0, 60), user_mode: mode, messages: [], updated_at: new Date().toISOString() }).catch(() => {});
    } catch (e) {
      setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, text: `Error: ${e.message}`, streaming: false, error: true } : m));
    }
    setLoading(false);
  }

  function handleKey(e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }
  const showWelcome = messages.length === 0;

  return (
    <div className="chat-page">
      <div className="chat-sidebar">
        <div className="cs-section">
          <div className="section-label">Mode</div>
          <button className={`mode-btn ${mode === 'evp' ? 'mode-btn--active' : ''}`} onClick={() => setMode('evp')}><span className="mode-icon">◈</span> EVP Briefing</button>
          <button className={`mode-btn ${mode === 'operational' ? 'mode-btn--active' : ''}`} onClick={() => setMode('operational')}><span className="mode-icon">☰</span> Operational</button>
        </div>
        <div className="cs-section cs-section--grow">
          <div className="section-label">Quick actions</div>
          {QUICK_ACTIONS.map(a => <button key={a.label} className="qa-btn" onClick={() => send(a.prompt)}>{a.label}</button>)}
        </div>
        {messages.length > 0 && (
          <div className="cs-section">
            <button className="btn" style={{width:'100%',justifyContent:'center',fontSize:'12px'}} onClick={() => setMessages([])}>New conversation</button>
          </div>
        )}
      </div>

      <div className="chat-main">
        <div className="chat-header">
          <div>
            <div className="chat-title">AI Analyst</div>
            <div className="mono muted" style={{fontSize:'10px'}}>LISCR PSC Intelligence · {mode === 'evp' ? 'EVP Briefing Mode' : 'Operational Mode'}</div>
          </div>
          <div className="chat-header-right">
            <div className="dot-live"></div>
            <span className="mono muted" style={{fontSize:'10px'}}>107 detentions · 136 PDAIP tasks loaded</span>
          </div>
        </div>

        <div className="messages">
          {showWelcome && (
            <div className="welcome">
              <div className="mono accent" style={{fontSize:'10px',letterSpacing:'.1em',marginBottom:'14px',opacity:.7}}>LISCR · PSC INTELLIGENCE · {mode === 'evp' ? 'EVP BRIEFING MODE' : 'OPERATIONAL MODE'}</div>
              <h2 className="welcome-h">Good morning. What do you need to know?</h2>
              <p className="welcome-sub muted">Full fleet detention data, PDAIP task list, PSC tracker, and case documents for active vessels. May 2026 data fully loaded.</p>
              <div className="welcome-grid">
                {[
                  { l: 'Fleet performance', p: QUICK_ACTIONS[0].prompt },
                  { l: 'OCEAN GALAXY case', p: QUICK_ACTIONS[2].prompt },
                  { l: 'Decisions required', p: QUICK_ACTIONS[1].prompt },
                  { l: 'May 2026 summary', p: QUICK_ACTIONS[5].prompt },
                ].map(c => (
                  <button key={c.l} className="welcome-card" onClick={() => send(c.p)}>
                    <div className="mono accent" style={{fontSize:'9px',letterSpacing:'.07em',textTransform:'uppercase',marginBottom:'3px'}}>{c.l}</div>
                    <div style={{fontSize:'11px',color:'var(--text-secondary)',lineHeight:1.4}}>Click to ask</div>
                  </button>
                ))}
              </div>
              <div className="hint-chips">
                {HINT_CHIPS.map(h => <button key={h} className="hint-chip" onClick={() => send(h)}>{h}</button>)}
              </div>
            </div>
          )}
          {messages.map(m => (
            <div key={m.id} className={`msg msg--${m.role}`}>
              <div className="msg-src mono muted">{m.role === 'user' ? (mode === 'evp' ? 'EVP' : 'Analyst') : 'LISCR Intelligence'}</div>
              <div className={`msg-bubble ${m.error ? 'msg-bubble--error' : ''}`}>
                {m.role === 'assistant' ? <div dangerouslySetInnerHTML={{ __html: renderText(m.text) }} /> : m.text}
                {m.streaming && <span className="cursor-blink">▎</span>}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        <div className="chat-input-area">
          {!showWelcome && (
            <div className="hint-chips hint-chips--compact">
              {HINT_CHIPS.slice(0,3).map(h => <button key={h} className="hint-chip" onClick={() => send(h)}>{h}</button>)}
            </div>
          )}
          <div className="input-row">
            <textarea
              className="chat-textarea"
              placeholder={mode === 'evp' ? 'Ask about fleet performance, decisions, vessels…' : 'Ask about specific tasks, deficiencies, assignees…'}
              value={input}
              onChange={e => { setInput(e.target.value); e.target.style.height='auto'; e.target.style.height=Math.min(e.target.scrollHeight,120)+'px'; }}
              onKeyDown={handleKey}
              rows={1}
              disabled={loading}
            />
            <button className="send-btn btn-primary btn" disabled={loading || !input.trim()} onClick={() => send()}>
              {loading ? <div className="spinner" style={{width:16,height:16}}></div> : '↑ Send'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
