import React, { useState, useRef, useEffect } from 'react';
import Login from './pages/Login';
import MyTasks from './pages/MyTasks';
import { MASTER_PROMPT } from './lib/masterPrompt';
import PdaipPage from './pages/PdaipPage';
import InitiativeTracker from './pages/InitiativeTracker';
import PatternDetection from './pages/PatternDetection';
import InspectorNetwork from './pages/InspectorNetwork';
import AISMonitor from './pages/AISMonitor';
import VIPProtocol from './pages/VIPProtocol';
import MeetingMinutes from './pages/MeetingMinutes';
import AdminPanel from './pages/AdminPanel';
import CaseView from './pages/CaseView';

import './App.css';

const SYSTEM_PROMPT = MASTER_PROMPT; const _OLD = `dummy embedded in the LISCR PSC Detention Intelligence Platform. Fleet data Jan-Jun 2026: 107 detentions, Tokyo MOU 51, Paris MOU 25, AMSA 14, USCG 8. Monthly: Jan 23, Feb 21, Mar 19, Apr 19, May 20, Jun 5. Rate is FLAT not improving. Repeat detainees 12 months: 7. Client rejections: 12 all then detained. PDAIP: 136 tasks, 28 open, 69 assigned to Ankita. 72 vessels no PDAIP tasks. Top cause: ISM Code 22/107. OCEAN GALAXY: detained 28 May Tauranga NZ, 14 defs, 2 detainable, KR survey 26 days before 0 findings, HMM 44 vessels HRS since Mar 2026, WHISTLEBLOWER active, FRAUDULENT LOG BOOK def 8, release needs Flag State audit not yet submitted. 8 gaps: (1) no enforcement refusal policy EVP decision (2) no cancellation threshold EVP decision (3) no effectiveness verification process (4) 72 no PDAIP process (5) 3 systems disconnected (6) no RO oversight protocol (7) 51pct on Ankita resource (8) Inspector App 5 months testing resource. Be direct, specific, honest. Lead with critical finding.`;

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const canEdit = !currentUser || currentUser.role === "Super Admin" || currentUser.role === "Admin";
  const canDelete = !currentUser || currentUser.role === "Super Admin";
  const canDownload = !currentUser || currentUser.role === "Super Admin" || currentUser.role === "Admin";
  const [page, setPage] = useState('home');
  const [role, setRole] = useState('op');
  const [userRole, setUserRole] = useState('Super Admin'); // Super Admin / Admin / Viewer
  const [chatMessages, setChatMessages] = useState([
    { role: 'ai', text: 'Good morning. I have your full fleet data loaded — 107 detentions Jan–Jun 2026, 136 PDAIP tasks, and all active case files including OCEAN GALAXY. What do you need?' }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [processing, setProcessing] = useState(false);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const titles = { ais:'AIS / LRIT Monitor', inspector:'Inspector Network', vip:'VIP Client Protocol', meeting:'Meeting Minutes', initiatives:'Initiative Tracker', patterns:'Pattern Detection', admin:'Admin Panel',
    home: 'My dashboard', evp: 'EVP briefing', questions: 'EVP questions',
    gaps: 'Critical gaps', tasks: 'My tasks', upload: 'Upload & analyze',
    case: 'Case view', pdaip: 'PDAIP analysis', fleet: 'Fleet dashboard',
    tracker: 'PSC tracker', chat: 'AI assistant'
  };

  function nav(p) { setPage(p); }

  function ni(id) {
    return `ni${page === id ? ' on' : ''}`;
  }

  async function sendChat(text) {
    const q = text || chatInput;
    if (!q.trim() || chatLoading) return;
    setChatInput('');
    setChatMessages(prev => [...prev, { role: 'user', text: q }]);
    setChatLoading(true);
    const aiId = Date.now();
    setChatMessages(prev => [...prev, { role: 'ai', text: '...', id: aiId }]);
    try {
      const apiKey = process.env.REACT_APP_ANTHROPIC_API_KEY;
      const history = chatMessages.map(m => ({ role: m.role === 'ai' ? 'assistant' : 'user', content: m.text }));
      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 1000, system: SYSTEM_PROMPT, messages: [...history, { role: 'user', content: q }] })
      });
      const data = await resp.json();
      const reply = data.content?.map(b => b.text || '').join('') || 'Error getting response.';
      setChatMessages(prev => prev.map(m => m.id === aiId ? { ...m, text: reply } : m));
    } catch (e) {
      setChatMessages(prev => prev.map(m => m.id === aiId ? { ...m, text: 'Error: ' + e.message } : m));
    }
    setChatLoading(false);
  }

  function handleFiles(e) {
    const files = Array.from(e.target.files);
    setUploadedFiles(prev => [...prev, ...files.map(f => ({ name: f.name, size: f.size, type: f.name.split('.').pop().toUpperCase(), status: 'ready' }))]);
  }

  function startProcessing() {
    setProcessing(true);
    setPage('proc');
    setTimeout(() => { setProcessing(false); setPage('case'); }, 3000);
  }

  return (
    !currentUser ? <Login onLogin={setCurrentUser} /> :
    <div className="shell">
      {/* SIDEBAR */}
      <div className="sb">
        <div className="sb-logo">
          <div className="sb-logo-mark"><i className="ti ti-ship"></i></div>
          <div>
            <div className="sb-logo-text">LISCR PSC</div>
            <div className="sb-logo-sub">Intelligence Platform</div>
          </div>
        </div>

        <div className="role-panel">
          <div className="role-lbl">Viewing as</div>
          <div className={`role-btn${role==='evp'?' on':''}`} onClick={() => setRole('evp')}>
            <div className="rav" style={{background:'var(--blue)',color:'#fff'}}>EVP</div>
            <div><div className="rb-name">EVP / Leadership</div><div className="rb-role">Strategic briefing</div></div>
          </div>
          <div className={`role-btn${role==='op'?' on':''}`} onClick={() => setRole('op')}>
            <div className="rav" style={{background:'var(--purple)',color:'#fff'}}>AS</div>
            <div><div className="rb-name">Fleet Performance Lead</div><div className="rb-role">Fleet Performance</div></div>
          </div>
        </div>

        {role === 'op' && (
          <div className="user-panel">
            <div className="user-row">
              <div className="u-av" style={{background:'var(--purple)',color:'#fff'}}>AS</div>
              <div><div className="u-name">Fleet Performance Lead</div><div className="u-role">Fleet Performance · LISCR</div></div>
            </div>
            <div className="u-stats">
              <div className="ustat"><div className="ustat-v">69</div><div className="ustat-l">Tasks</div></div>
              <div className="ustat"><div className="ustat-v" style={{color:'var(--red2)'}}>28</div><div className="ustat-l">Open</div></div>
              <div className="ustat"><div className="ustat-v" style={{color:'var(--amber2)'}}>12</div><div className="ustat-l">Overdue</div></div>
            </div>
          </div>
        )}

        <div className="sb-nav">
          <div className="ng">Executive</div>
          <div className={ni('evp')} onClick={() => nav('evp')}><i className="ti ti-presentation"></i> EVP briefing</div>
          <div className={ni('questions')} onClick={() => nav('questions')}><i className="ti ti-help-circle"></i> EVP questions <span className="nb nb-r">12</span></div>
          <div className={ni('gaps')} onClick={() => nav('gaps')}><i className="ti ti-alert-triangle"></i> Critical gaps <span className="nb nb-r">8</span></div>
          <div className="ng">My Workspace</div>
          <div className={ni('home')} onClick={() => nav('home')}><i className="ti ti-home"></i> My dashboard <span className="nb nb-r">12</span></div>
          <div className={ni('tasks')} onClick={() => nav('tasks')}><i className="ti ti-checklist"></i> My tasks <span className="nb nb-r">28</span></div>
          <div className="ng">Analysis</div>
          <div className={ni('upload')} onClick={() => nav('upload')}><i className="ti ti-upload"></i> Upload &amp; analyze</div>
          <div className={ni('case')} onClick={() => nav('case')}><i className="ti ti-file-analytics"></i> Case view <span className="nb nb-b">1</span></div>
          <div className={ni('pdaip')} onClick={() => nav('pdaip')}><i className="ti ti-chart-dots"></i> PDAIP analysis</div>
          <div className={ni('fleet')} onClick={() => nav('fleet')}><i className="ti ti-chart-bar"></i> Fleet dashboard</div>
          <div className={ni('ais')} onClick={() => nav('ais')}><i className="ti ti-radar"></i> AIS monitor</div>
          <div className={ni('inspector')} onClick={() => nav('inspector')}><i className="ti ti-users"></i> Inspector network</div>
          <div className={ni('vip')} onClick={() => nav('vip')}><i className="ti ti-shield-check"></i> VIP protocol</div>
          <div className={ni('meeting')} onClick={() => nav('meeting')}><i className="ti ti-notes"></i> Meeting minutes</div>
          <div className={ni('initiatives')} onClick={() => nav('initiatives')}><i className="ti ti-rocket"></i> Initiatives</div>
          <div className={ni('patterns')} onClick={() => nav('patterns')}><i className="ti ti-scan"></i> Pattern detection</div>
          <div className={ni('tracker')} onClick={() => nav('tracker')}><i className="ti ti-table"></i> PSC tracker</div>
          <div className="ng">Assistant</div>
          <div className={ni('chat')} onClick={() => nav('chat')}><i className="ti ti-message-circle"></i> AI assistant</div>
          <div className="ng">System</div>
          <div className={ni('admin')} onClick={() => nav('admin')}><i className="ti ti-shield-lock"></i> Admin panel</div>
          <div className="ng">Team</div>
          <div className="ni"><i className="ti ti-user"></i> RGiorgioS Lead (R&amp;S) <span className="nb nb-b">22</span></div>
          <div className="ni"><i className="ti ti-user"></i> MLC Lead (MLC) <span className="nb nb-b">9</span></div>
          <div className="ni"><i className="ti ti-user"></i> PSC Affairs Lead Witt <span className="nb nb-a">2</span></div>
        </div>
      </div>

      {/* MAIN */}
      <div className="mn">
        <div className="topbar">
          <div className="topbar-t">{titles[page] || page}</div>
          <div className="topbar-r">
            <div className="time-badge">Jun 2026</div>
            <button className="btn" onClick={() => nav('chat')}><i className="ti ti-sparkles"></i> Ask AI</button>
            <button className="btn btn-primary" onClick={() => nav('upload')}><i className="ti ti-upload"></i> Upload docs</button>
          </div>
        </div>

        <div className="content">

          {/* HOME */}
          {page === 'home' && (
            <div className="pg active">
              <div className="al al-r"><i className="ti ti-alert-triangle"></i><div><strong>12 tasks overdue.</strong> ANDREAS K (3), ROTTERDAM PEARL V (69 days), ROSTRUM STOIC, EC FATMA, CONTSHIP CUB, BBG WUZHOU, SOPOT.</div></div>
              <div className="al al-a"><i className="ti ti-alert-circle"></i><div><strong>51% of all PDAIP tasks are yours</strong> (69/136) — single point of failure. 7–8 immediately delegatable to RGiorgioS Lead, MLC Lead, Admin Lead.</div></div>
              <div className="two">
                <div className="card"><div className="card-t">Your open tasks by status</div>
                  <div className="bar-r"><div className="bar-l">To Do (16)</div><div className="bar-t"><div className="bar-f" style={{width:'57%',background:'var(--red)'}}></div></div><div className="bar-v">16</div></div>
                  <div className="bar-r"><div className="bar-l">In Progress (12)</div><div className="bar-t"><div className="bar-f" style={{width:'43%',background:'var(--amber)'}}></div></div><div className="bar-v">12</div></div>
                  <div className="bar-r"><div className="bar-l">Completed (27)</div><div className="bar-t"><div className="bar-f" style={{width:'96%',background:'var(--green)'}}></div></div><div className="bar-v">27</div></div>
                  <div className="bar-r"><div className="bar-l">Executed (14)</div><div className="bar-t"><div className="bar-f" style={{width:'50%',background:'var(--purple)'}}></div></div><div className="bar-v">14</div></div>
                </div>
                <div className="card"><div className="card-t">Critical items right now</div>
                  <div style={{display:'flex',flexDirection:'column',gap:'6px',fontSize:'11px'}}>
                    <div style={{display:'flex',justifyContent:'space-between',padding:'5px 0',borderBottom:'1px solid var(--border)'}}><span style={{color:'var(--text2)'}}><strong style={{color:'var(--text)'}}>OCEAN GALAXY</strong> — HMM report</span><span className="badge b-p">Whistleblower</span></div>
                    <div style={{display:'flex',justifyContent:'space-between',padding:'5px 0',borderBottom:'1px solid var(--border)'}}><span style={{color:'var(--text2)'}}><strong style={{color:'var(--text)'}}>ANDREAS K</strong> — cancellation</span><span className="badge b-r">Re-detained</span></div>
                    <div style={{display:'flex',justifyContent:'space-between',padding:'5px 0',borderBottom:'1px solid var(--border)'}}><span style={{color:'var(--text2)'}}><strong style={{color:'var(--text)'}}>AMI</strong> — company summary</span><span className="badge b-a">Jun 15</span></div>
                    <div style={{display:'flex',justifyContent:'space-between',padding:'5px 0'}}><span style={{color:'var(--text2)'}}><strong style={{color:'var(--text)'}}>ROTTERDAM PEARL V</strong> — WeChat</span><span className="badge b-r">69d over</span></div>
                  </div>
                </div>
              </div>
              <div style={{display:'flex',gap:'7px',flexWrap:'wrap'}}>
                <button className="btn btn-primary" onClick={() => nav('tasks')}><i className="ti ti-checklist"></i> My 28 open tasks</button>
                <button className="btn" onClick={() => nav('pdaip')}><i className="ti ti-chart-dots"></i> PDAIP analysis</button>
                <button className="btn" onClick={() => nav('evp')}><i className="ti ti-presentation"></i> EVP briefing</button>
                <button className="btn" onClick={() => nav('upload')}><i className="ti ti-upload"></i> Upload documents</button>
              </div>
            </div>
          )}

          {/* EVP BRIEFING */}
          {page === 'evp' && (
            <div className="pg active">
              <div className="al al-b"><i className="ti ti-presentation"></i><div><strong>Executive briefing view</strong> — Prepared for EVP meeting Jun 2026. Strategic picture, key risks, and decisions required.</div></div>
              <div className="mg4">
                <div className="met"><div className="m-l">Detentions Jan–May</div><div className="m-v">107</div><div className="m-s">Liberia-flagged fleet</div></div>
                <div className="met"><div className="m-l" style={{color:'var(--red2)'}}>Detained 2+ times</div><div className="m-v" style={{color:'var(--red2)'}}>7</div><div className="m-s">within 12 months</div></div>
                <div className="met"><div className="m-l" style={{color:'var(--amber2)'}}>PDAIP tasks open</div><div className="m-v" style={{color:'var(--amber2)'}}>28</div><div className="m-s">21% of program</div></div>
                <div className="met"><div className="m-l" style={{color:'var(--red2)'}}>Inspection refusals</div><div className="m-v" style={{color:'var(--red2)'}}>12</div><div className="m-s">all then detained</div></div>
              </div>
              <div className="two">
                <div className="card"><div className="card-t">✅ What is working</div>
                  <div style={{display:'flex',flexDirection:'column',gap:'7px',fontSize:'11px'}}>
                    <div style={{display:'flex',gap:'8px',color:'var(--text2)'}}><span style={{color:'var(--green)',flexShrink:0}}>✓</span><div><strong style={{color:'var(--text)'}}>Dispensation reform (fleet-wide MA).</strong> CARLA C → revised Marine Advisory → all Regional Technical Managers briefed.</div></div>
                    <div style={{display:'flex',gap:'8px',color:'var(--text2)'}}><span style={{color:'var(--green)',flexShrink:0}}>✓</span><div><strong style={{color:'var(--text)'}}>7 WayPoint workflow fixes (EC TURAN).</strong> P1P boarding automated, Board/Do Not Board decisions documented.</div></div>
                    <div style={{display:'flex',gap:'8px',color:'var(--text2)'}}><span style={{color:'var(--green)',flexShrink:0}}>✓</span><div><strong style={{color:'var(--text)'}}>China mandatory boarding policy.</strong> 6-month trigger implemented. Tokyo MoU = 51/107 detentions.</div></div>
                    <div style={{display:'flex',gap:'8px',color:'var(--text2)'}}><span style={{color:'var(--green)',flexShrink:0}}>✓</span><div><strong style={{color:'var(--text)'}}>FMP-001 engine failure procedure (RUBY TOWER).</strong> Fleet-wide Work Instruction.</div></div>
                  </div>
                </div>
                <div className="card"><div className="card-t">✗ What is not working</div>
                  <div style={{display:'flex',flexDirection:'column',gap:'7px',fontSize:'11px'}}>
                    <div style={{display:'flex',gap:'8px',color:'var(--text2)'}}><span style={{color:'var(--red)',flexShrink:0}}>✗</span><div><strong style={{color:'var(--text)'}}>Re-detentions despite completed actions.</strong> ANDREAS K: all Feb actions complete → re-detained April. No verification step.</div></div>
                    <div style={{display:'flex',gap:'8px',color:'var(--text2)'}}><span style={{color:'var(--red)',flexShrink:0}}>✗</span><div><strong style={{color:'var(--text)'}}>54% of PDAIP actions are generic templates.</strong> "Client meeting," "monitoring," "RO oversight" applied regardless of cause.</div></div>
                    <div style={{display:'flex',gap:'8px',color:'var(--text2)'}}><span style={{color:'var(--red)',flexShrink:0}}>✗</span><div><strong style={{color:'var(--text)'}}>No enforcement when clients refuse inspections.</strong> 12 refusals → 12 detentions. Response: email only.</div></div>
                    <div style={{display:'flex',gap:'8px',color:'var(--text2)'}}><span style={{color:'var(--red)',flexShrink:0}}>✗</span><div><strong style={{color:'var(--text)'}}>72 detained vessels have no PDAIP tasks.</strong> Tracked in PSC system but never analyzed.</div></div>
                  </div>
                </div>
              </div>
              <div className="sec">Vessels the EVP will ask about</div>
              <div className="two">
                <div className="card border-red"><div className="card-t" style={{color:'var(--red2)',fontSize:'11px'}}>ANDREAS K — 2 detentions in 10 weeks</div><div style={{fontSize:'11px',color:'var(--text2)',lineHeight:1.6}}>Feb (17 defs, Korea) → all actions complete → Apr (8 defs, China). <strong style={{color:'var(--text)'}}>Cancellation decision overdue.</strong></div></div>
                <div className="card border-red"><div className="card-t" style={{color:'var(--red2)',fontSize:'11px'}}>ALICIA — 5 detentions in 16 months</div><div style={{fontSize:'11px',color:'var(--text2)',lineHeight:1.6}}>All flag-side actions done. Operator unchanged. <strong style={{color:'var(--text)'}}>No automatic cancellation threshold exists.</strong></div></div>
                <div className="card border-purple"><div className="card-t" style={{color:'var(--purple2)',fontSize:'11px'}}>OCEAN GALAXY — Active detention, whistleblower</div><div style={{fontSize:'11px',color:'var(--text2)',lineHeight:1.6}}>14 defs, 2 detainable. Fraudulent lifeboat log. KR survey 26 days prior: 0 findings. <strong style={{color:'var(--text)'}}>Senior approval before HMM contact.</strong></div></div>
                <div className="card border-amber"><div className="card-t" style={{color:'var(--amber2)',fontSize:'11px'}}>HMM Ocean Service — 5 fleet detentions / 24 mo.</div><div style={{fontSize:'11px',color:'var(--text2)',lineHeight:1.6}}>44 Liberia vessels. HRS since Mar 2026. <strong style={{color:'var(--text)'}}>Fleet-wide SMS review required.</strong></div></div>
              </div>
              <div style={{display:'flex',gap:'7px',flexWrap:'wrap'}}>
                <button className="btn btn-primary" onClick={() => nav('questions')}><i className="ti ti-help-circle"></i> 12 EVP questions</button>
                <button className="btn" onClick={() => nav('gaps')}><i className="ti ti-alert-triangle"></i> 8 critical gaps</button>
                <button className="btn" onClick={() => { nav('chat'); sendChat('Prepare a 5-minute verbal briefing for the EVP on the detention program status'); }}><i className="ti ti-sparkles"></i> Prep with AI</button>
              </div>
            </div>
          )}

          {/* EVP QUESTIONS */}
          {page === 'questions' && (
            <div className="pg active">
              <div className="hl"><strong>12 questions the EVP is most likely to ask</strong> — each with the answer and the gap to be aware of.</div>
              <div className="sec">Strategic / performance</div>
              {[
                { n:'1', c:'qn-r', q:'Is the detention rate getting better or worse — and why?', a:'Jan 23 · Feb 21 · Mar 19 · Apr 19 · May 20. Stabilized, not improved. Mar/Apr dip aligns with EC TURAN WayPoint fixes and China boarding policy. May crept back to 20. Rate is not falling.', g:'Gap: No 2024 baseline for comparison. Cannot yet attribute stabilization to our interventions vs. seasonal variation.', gc:'qg-r' },
                { n:'2', c:'qn-r', q:'ANDREAS K was detained twice after we said actions were completed. How?', a:'February actions addressed how LISCR inspects — not why the vessel fails (maintenance culture). "Completed" = task executed, not problem fixed. No verification step in PDAIP.', g:'Gap: No effectiveness verification protocol. PDAIP cannot link a completed action to a measurable outcome.', gc:'qg-r' },
                { n:'3', c:'qn-r', q:'12 companies refused our inspections then got detained. What are we doing?', a:'Current response: email. No formal escalation policy, no registration consequence, no threshold. Cost of refusing is zero. Benefit (avoiding inspection) is high.', g:'Gap: No enforcement mechanism. EVP approval of a 3-strike policy changes operator behavior fleet-wide with no system change.', gc:'qg-r' },
                { n:'4', c:'qn-r', q:'Why is ALICIA still on our registry after 5 detentions?', a:'Every available flag-side action taken. Operator unchanged. No automatic cancellation threshold exists. Decision requires deliberate escalation that has not been made.', g:'Gap: No defined criteria for deregistration after N detentions in M months. All cancellation decisions are ad-hoc.', gc:'qg-r' },
              ].map(q => (
                <div key={q.n} className="qc">
                  <div className="qh"><div className={`qn ${q.c}`}>{q.n}</div><div className="qt">{q.q}</div></div>
                  <div className="qa">{q.a}</div>
                  <div className={`qg ${q.gc}`}>⚠ {q.g}</div>
                </div>
              ))}
              <div className="sec">Operational / program</div>
              {[
                { n:'5', c:'qn-a', q:'"51% of PDAIP is assigned to one person. Is that a risk?"', a:'Yes — capacity and quality risk. Concentration prevents specialization. 7–8 tasks immediately delegatable. Load drops 69 → 41.', g:'Gap: No delegation framework or task ownership policy approved.', gc:'qg-r' },
                { n:'6', c:'qn-a', q:'"72 vessels have no PDAIP analysis. What happened?"', a:'PSC report received, CAR logged, case closed. No PDAIP tasks ever created. EVER ONWARD (18 defs), BRISTOL (26 defs), MSC SARYA III (27 defs) and 69 others: tracked but not analyzed.', g:'Gap: No automatic PDAIP task creation. Manual step depending on individual judgment.', gc:'qg-r' },
                { n:'7', c:'qn-a', q:'"OCEAN GALAXY — current status and release timeline?"', a:'Detained Tauranga NZ since 28 May. Release requires Flag State audit covering MLC Title 4 + ISM Elements 7/8/12 submitted to Maritime NZ. No release date — audit not yet submitted. Probable whistleblower. Confirmed fraudulent log book.', g:'Gap: Flag audit task was missing from PDAIP until this analysis surfaced it. Legal condition for release was untracked.', gc:'qg-r' },
                { n:'8', c:'qn-a', q:'"Most common reasons our vessels are detained?"', a:'ISM Code failure (22) · Fire safety (18) · LSA/emergency (15) · Corrosion (10) · MLC/Manning (9). ISM failures concentrated in Tokyo MoU — 51 of 107 detentions.', g:'Note: Deficiency code frequency requires all 107 PSC reports uploaded for exact fleet-wide breakdown.', gc:'qg-a' },
              ].map(q => (
                <div key={q.n} className="qc">
                  <div className="qh"><div className={`qn ${q.c}`}>{q.n}</div><div className="qt">{q.q}</div></div>
                  <div className="qa">{q.a}</div>
                  <div className={`qg ${q.gc}`}>⚠ {q.g}</div>
                </div>
              ))}
              <div className="sec">Challenge questions</div>
              {[
                { n:'9', c:'qn-r', q:'"KR surveyed OCEAN GALAXY 26 days before PSC — 0 findings. PSC found 9 ISM deficiencies. What does that say about our RO?"', a:'Three possibilities: KR examined different records; evidence concealed during KR (consistent with whistleblower); or genuine 26-day deterioration — unlikely for structural ISM failures. Formal RO inquiry must ask which records KR reviewed on 2 May.', g:'Gap: Only 1 of 107 detentions triggered RO additional audit action.', gc:'qg-r' },
                { n:'10', c:'qn-r', q:'"Are we actually improving? How many PDAIP actions measurably prevented a detention?"', a:'Honest answer: we do not know. Systemic changes exist (dispensation reform, WayPoint fixes, China boarding policy, FMP-001). But no outcome measurement framework exists.', g:'Gap: No outcome measurement framework. Deepest structural gap in the program.', gc:'qg-r' },
                { n:'11', c:'qn-r', q:'"Case Owner B has 28% of cases unresolved. Performance or capacity issue?"', a:'Both. He has the hardest cases (EC FATMA 39 defs, BRISTOL 26 defs). But also 5 cases with no action type assigned at all — that is a process gap.', g:'Gap: No system check requiring action type before case is in progress.', gc:'qg-r' },
                { n:'12', c:'qn-r', q:'"What\'s the ONE change with the biggest impact on reducing detentions?"', a:'Mandatory escalation policy for inspection refusals. 12 refusals → 12 detentions. A 3-strike policy changes operator behavior fleet-wide. No system change needed.', g:'This requires no system change. EVP can approve this in the meeting today.', gc:'qg-g' },
              ].map(q => (
                <div key={q.n} className="qc">
                  <div className="qh"><div className={`qn ${q.c}`}>{q.n}</div><div className="qt">{q.q}</div></div>
                  <div className="qa">{q.a}</div>
                  <div className={`qg ${q.gc}`}{...{}}>{q.gc === 'qg-g' ? '✓' : '⚠'} {q.g}</div>
                </div>
              ))}
              <div style={{marginTop:'10px',display:'flex',gap:'7px'}}>
                <button className="btn btn-primary" onClick={() => nav('gaps')}><i className="ti ti-alert-triangle"></i> See 8 critical gaps</button>
                <button className="btn" onClick={() => nav('chat')}><i className="ti ti-sparkles"></i> Ask AI</button>
              </div>
            </div>
          )}

          {/* GAPS */}
          {page === 'gaps' && (
            <div className="pg active">
              <div className="hl"><strong>8 structural gaps</strong> — what the EVP will ask about that do not have a clean answer yet.</div>
              <div className="sec">Require EVP decision (governance only — no system change)</div>
              <div className="gap-c g-r"><div className="gc-t">Gap 1 — No enforcement policy for inspection refusals <span className="badge b-r">EVP decision</span></div><div className="gc-b">12 companies refused preemptive inspections → all 12 then detained. Response: email. No cost to refuse. No escalation, no registration consequence.</div><div className="gc-f"><strong>Fix:</strong> 3-strike policy — warning → compliance review → registration consequence. Governance only. <strong>Owner: EVP + Senior Management.</strong></div></div>
              <div className="gap-c g-r"><div className="gc-t">Gap 2 — No automatic cancellation criteria for repeat detainees <span className="badge b-r">EVP decision</span></div><div className="gc-b">ALICIA (5/16 months), ANDREAS K (2/10 weeks). Flag-side actions cannot change operator behavior without registration consequence. Cancellation is currently ad-hoc.</div><div className="gc-f"><strong>Fix:</strong> Threshold — 3+ detentions in 18 months → auto cancellation review with 30-day response window. <strong>Owner: Senior Management / Ankita.</strong></div></div>
              <div className="sec">Require process change</div>
              <div className="gap-c g-a"><div className="gc-t">Gap 3 — No effectiveness verification in PDAIP <span className="badge b-a">Process</span></div><div className="gc-b">"Completed" = task done, not = problem fixed. ANDREAS K Feb actions complete → re-detained April with same underlying failures.</div><div className="gc-f"><strong>Fix:</strong> Mandatory outcome verification before Executed status. <strong>Owner: Fatema / IT.</strong></div></div>
              <div className="gap-c g-a"><div className="gc-t">Gap 4 — 72 detained vessels with no PDAIP tasks <span className="badge b-a">Process</span></div><div className="gc-b">PSC report received → CAR logged → closed. No PDAIP created. BRISTOL (26 defs), MSC SARYA III (27 defs) and 70 others: unanalyzed.</div><div className="gc-f"><strong>Fix:</strong> Auto-generate 1+ PDAIP task for every detention with 10+ defs or a detainable. <strong>Owner: IT / Ankita.</strong></div></div>
              <div className="gap-c g-a"><div className="gc-t">Gap 5 — Three systems that do not talk to each other <span className="badge b-a">System</span></div><div className="gc-b">PSC tracker (Excel) vs PDAIP tasks (CSV) vs raw PSC reports (PDFs): different stories, same vessel. EVELPIS: PDAIP = Completed, tracker = CAR not received.</div><div className="gc-f"><strong>Fix:</strong> This platform — PSC PDF upload auto-creates PDAIP tasks. <strong>Owner: IT / Product.</strong></div></div>
              <div className="gap-c g-a"><div className="gc-t">Gap 6 — No RO oversight protocol after post-survey detentions <span className="badge b-a">Process</span></div><div className="gc-b">Only 1 of 107 detentions triggered RO additional audit. KR surveyed OCEAN GALAXY 26 days before detention — 0 findings. RO survey gaps go uninvestigated.</div><div className="gc-f"><strong>Fix:</strong> Auto-trigger RO inquiry when PSC finds 5+ defs within 60 days of RO survey. <strong>Owner: RGiorgioS Lead / R&amp;S.</strong></div></div>
              <div className="sec">Require resource decision</div>
              <div className="gap-c g-b"><div className="gc-t">Gap 7 — 51% of PDAIP on one person <span className="badge b-b">Resource</span></div><div className="gc-b">Ankita: 69/136 tasks. Single point of failure. Prevents specialization. 7–8 immediately delegatable → 69 drops to ~41.</div><div className="gc-f"><strong>Fix:</strong> Delegation framework: R&amp;S technical → RGiorgioS Lead, MLC → MLC Lead, admin → Admin Lead Campbell. <strong>Owner: Ankita, 1 week.</strong></div></div>
              <div className="gap-c g-b"><div className="gc-t">Gap 8 — Inspector App "in testing" for 5+ months <span className="badge b-b">Resource</span></div><div className="gc-b">WeChat/comms gap open since January. "In testing" — no delivery date. Real-time inspector ↔ duty officer gap in China and remote ports.</div><div className="gc-f"><strong>Fix:</strong> EVP sets hard delivery date. If internal cannot meet it: approve interim WeChat solution. <strong>Owner: IT / Stephen Frey.</strong></div></div>
              <div style={{marginTop:'10px',display:'flex',gap:'7px'}}>
                <button className="btn btn-primary" onClick={() => { nav('chat'); sendChat('Write a 1-page executive summary of the 8 gaps with costs, owners, and timelines'); }}><i className="ti ti-file-description"></i> Executive summary via AI</button>
                <button className="btn" onClick={() => nav('chat')}><i className="ti ti-sparkles"></i> Ask AI</button>
              </div>
            </div>
          )}

          {/* MY TASKS */}
          {page === "tasks" && <MyTasks />}
          {/* UPLOAD */}
          {page === 'upload' && (
            <div className="pg active">
              <div className="uz" onClick={() => fileInputRef.current?.click()}>
                <div className="uz-icon"><i className="ti ti-cloud-upload"></i></div>
                <div className="uz-t">Drop documents here or click to upload</div>
                <div className="uz-s">PSC Form A+B (PDF) · Detention Analysis (DOCX) · PSC Tracker (XLSX) · PDAIP Tasks (CSV)</div>
                <input ref={fileInputRef} type="file" multiple accept=".pdf,.docx,.xlsx,.csv" style={{display:'none'}} onChange={handleFiles} />
              </div>
              {uploadedFiles.length > 0 && (
                <div>
                  {uploadedFiles.map((f,i) => (
                    <div key={i} style={{display:'flex',alignItems:'center',gap:'9px',padding:'8px 11px',border:'1px solid var(--border)',borderRadius:'var(--r)',background:'var(--bg2)',marginBottom:'5px'}}>
                      <div style={{width:'28px',height:'28px',borderRadius:'var(--r)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'9px',fontWeight:'700',background:f.type==='PDF'?'var(--red-bg)':f.type==='XLSX'?'var(--green-bg)':'var(--blue-bg)',color:f.type==='PDF'?'var(--red2)':f.type==='XLSX'?'var(--green2)':'var(--blue)',fontFamily:'var(--mono)'}}>{f.type}</div>
                      <div style={{flex:1}}><div style={{fontSize:'10px',fontWeight:'500',color:'var(--text)',fontFamily:'var(--mono)'}}>{f.name}</div><div style={{fontSize:'9px',color:'var(--text3)'}}>{(f.size/1024).toFixed(0)} KB · Ready</div></div>
                      <span style={{fontSize:'9px',padding:'2px 6px',borderRadius:'3px',background:'var(--green-bg)',color:'var(--green2)',fontFamily:'var(--mono)',fontWeight:'600'}}>READY</span>
                    </div>
                  ))}
                  <div style={{marginTop:'12px'}}>
                    <button className="btn btn-primary" onClick={startProcessing} style={{fontSize:'12px',padding:'8px 18px'}}><i className="ti ti-sparkles"></i> Analyze all documents</button>
                    <span style={{fontSize:'10px',color:'var(--text3)',marginLeft:'10px',fontFamily:'var(--mono)'}}>AI will extract, cross-reference, and detect gaps</span>
                  </div>
                </div>
              )}
              {uploadedFiles.length === 0 && (
                <div className="hl"><strong>What happens when you upload:</strong> AI reads your PSC Forms A+B to extract deficiency codes and conventions. Cross-references with PDAIP tasks to find gaps. Compares tracker status vs actual CAR documents. Flags contradictions and generates missing tasks automatically.</div>
              )}
            </div>
          )}

          {/* PROCESSING */}
          {page === 'proc' && (
            <div className="pg active">
              <div className="proc-wrap">
                <div className="spinner"></div>
                <div style={{fontSize:'14px',fontWeight:'600'}}>Analyzing documents…</div>
                <div style={{fontSize:'10px',color:'var(--text3)',marginTop:'4px',fontFamily:'var(--mono)'}}>Cross-referencing PSC forms with PDAIP tasks</div>
                <div style={{maxWidth:'250px',margin:'16px auto 0',textAlign:'left'}}>
                  {['Reading PSC Form A+B','Extracting deficiency codes','Cross-referencing PDAIP','Detecting gaps and contradictions','Generating missing tasks'].map((s,i) => (
                    <div key={i} style={{display:'flex',alignItems:'center',gap:'8px',padding:'4px 0',fontSize:'11px',color:'var(--text3)',fontFamily:'var(--mono)'}}>
                      <div style={{width:'14px',height:'14px',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'8px',background:'var(--green-bg)',color:'var(--green2)',border:'1px solid #1A3016',flexShrink:0}}>✓</div>
                      {s}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* CASE VIEW */}
          {page === 'case' && <CaseView />}
          {false && (
            <div className="pg active">
              <div className="al al-r"><i className="ti ti-alert-triangle"></i><div><strong>Whistleblower case</strong> — all HMM contact needs senior approval. Do not disclose source.</div></div>
              <div className="al al-r" style={{marginTop:'-2px'}}><i className="ti ti-x"></i><div><strong>Fraudulent Official Log Book (def #8)</strong> — confirmed by crew testimony. Formal investigation required.</div></div>
              <div className="mg4">
                <div className="met"><div className="m-l">Deficiencies</div><div className="m-v">14</div><div className="m-s">2 detainable (Code 30)</div></div>
                <div className="met"><div className="m-l">Documents read</div><div className="m-v">4</div><div className="m-s">cross-referenced</div></div>
                <div className="met"><div className="m-l" style={{color:'var(--red2)'}}>Gaps found</div><div className="m-v" style={{color:'var(--red2)'}}>7</div><div className="m-s">missing in PDAIP</div></div>
                <div className="met"><div className="m-l" style={{color:'var(--blue)'}}>Tasks generated</div><div className="m-v" style={{color:'var(--blue)'}}>7</div><div className="m-s">6 new · 1 expanded</div></div>
              </div>
              <div className="two">
                <div className="card"><div className="card-t">Vessel facts</div>
                  <table className="tbl">
                    <tbody>
                      <tr><td style={{color:'var(--text3)'}}>Vessel / IMO</td><td><strong>OCEAN GALAXY</strong> · 9852705</td></tr>
                      <tr><td style={{color:'var(--text3)'}}>Company</td><td>HMM Ocean Service (5 dets/24 mo.)</td></tr>
                      <tr><td style={{color:'var(--text3)'}}>Detained</td><td>28 May 2026 · Tauranga, NZ</td></tr>
                      <tr><td style={{color:'var(--text3)'}}>Class / RO</td><td>Korean Register (KR)</td></tr>
                      <tr><td style={{color:'var(--text3)'}}>Last KR survey</td><td>2 May 2026 — <span style={{color:'var(--red2)'}}>26 days before</span></td></tr>
                      <tr><td style={{color:'var(--text3)'}}>HRS status</td><td><span className="badge b-r">High Risk since Mar 2026</span></td></tr>
                      <tr><td style={{color:'var(--text3)'}}>Appeal</td><td><span className="badge b-r">Not recommended</span></td></tr>
                    </tbody>
                  </table>
                </div>
                <div className="card"><div className="card-t">7 Required actions</div>
                  {[
                    { p:'b-r', t:'CRITICAL', a:'Submit Flag State audit (MLC Title 4 + ISM 7/8/12) to Maritime NZ before departure' },
                    { p:'b-r', t:'CRITICAL', a:'Investigate fraudulent Official Log Book (def #8). Notify DPA + Flag State' },
                    { p:'b-r', t:'URGENT', a:'Whistleblower protocol — senior approval before any HMM contact' },
                    { p:'b-a', t:'HIGH', a:'HMM company outreach after protocol cleared — 5 dets/24 mo, HRS, SMS review' },
                    { p:'b-a', t:'HIGH', a:'KR RO formal inquiry — which records reviewed on 2 May 2026?' },
                    { p:'b-b', t:'MEDIUM', a:'Request Maritime NZ delete def #11 (outside PSC jurisdiction)' },
                    { p:'b-b', t:'MEDIUM', a:'MLC-005 fleet review across HMM 44-vessel fleet' },
                  ].map((a,i) => (
                    <div key={i} style={{display:'flex',gap:'8px',padding:'6px 0',borderBottom:'1px solid var(--border)',fontSize:'11px'}}>
                      <span className={`badge ${a.p}`} style={{flexShrink:0,fontSize:'9px'}}>{a.t}</span>
                      <span style={{color:'var(--text2)',lineHeight:1.4}}>{a.a}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* PDAIP ANALYSIS */}
          {page === 'pdaip' && <PdaipPage /> }{false && (
            <div className="pg active">
              <div className="mg4">
                <div className="met"><div className="m-l">Total tasks</div><div className="m-v">136</div><div className="m-s">Jan–May 2026</div></div>
                <div className="met"><div className="m-l" style={{color:'var(--red2)'}}>Open</div><div className="m-v" style={{color:'var(--red2)'}}>28</div><div className="m-s">21% of program</div></div>
                <div className="met"><div className="m-l" style={{color:'var(--amber2)'}}>Ankita load</div><div className="m-v" style={{color:'var(--amber2)'}}>51%</div><div className="m-s">69/136 tasks</div></div>
                <div className="met"><div className="m-l" style={{color:'var(--red2)'}}>Formulaic</div><div className="m-v" style={{color:'var(--red2)'}}>22%</div><div className="m-s">~30 generic actions</div></div>
              </div>
              <div className="two">
                <div className="card"><div className="card-t">Task owner distribution</div>
                  {[
                    { n:'Fleet Performance Lead', v:69, pct:51, c:'var(--red)' },
                    { n:'RGiorgioS Lead De Sciora', v:22, pct:16, c:'var(--blue)' },
                    { n:'MLC Lead D\'Souza', v:9, pct:7, c:'var(--green)' },
                    { n:'Others', v:36, pct:26, c:'var(--text3)' },
                  ].map(r => (
                    <div key={r.n} className="bar-r">
                      <div className="bar-l">{r.n}</div>
                      <div className="bar-t"><div className="bar-f" style={{width:`${r.pct}%`,background:r.c}}></div></div>
                      <div className="bar-v">{r.v}</div>
                    </div>
                  ))}
                </div>
                <div className="card"><div className="card-t">Action quality analysis</div>
                  <div style={{fontSize:'11px',color:'var(--text2)',lineHeight:1.7}}>
                    <div style={{display:'flex',justifyContent:'space-between',padding:'4px 0',borderBottom:'1px solid var(--border)'}}><span>Substantive (cause-specific)</span><span style={{color:'var(--green2)',fontFamily:'var(--mono)'}}>78%</span></div>
                    <div style={{display:'flex',justifyContent:'space-between',padding:'4px 0',borderBottom:'1px solid var(--border)'}}><span>Formulaic (generic templates)</span><span style={{color:'var(--red2)',fontFamily:'var(--mono)'}}>22%</span></div>
                    <div style={{display:'flex',justifyContent:'space-between',padding:'4px 0',borderBottom:'1px solid var(--border)'}}><span>Duplicate tasks</span><span style={{color:'var(--amber2)',fontFamily:'var(--mono)'}}>9</span></div>
                    <div style={{display:'flex',justifyContent:'space-between',padding:'4px 0'}}><span>Vessels with zero tasks</span><span style={{color:'var(--red2)',fontFamily:'var(--mono)'}}>72</span></div>
                  </div>
                </div>
              </div>
              <div className="card"><div className="card-t">Re-detention risk: vessels with completed actions but systemic failures</div>
                {[
                  { v:'ANDREAS K', imo:'9491226', d:'2 detentions in 10 weeks. All Feb actions completed. Re-detained April. Maintenance culture unchanged.', r:'HIGH' },
                  { v:'ALICIA', imo:'9663623', d:'5 detentions in 16 months. All flag-side actions done. Operator unchanged. No cancellation threshold.', r:'CRITICAL' },
                  { v:'ROTTERDAM PEARL V', imo:'9557135', d:'WeChat task 69 days overdue. Inspector App still in testing. Gap persists.', r:'HIGH' },
                ].map(r => (
                  <div key={r.v} style={{display:'flex',alignItems:'flex-start',gap:'12px',padding:'8px 0',borderBottom:'1px solid var(--border)'}}>
                    <div style={{flex:1}}><div style={{fontSize:'11px',fontWeight:'600',color:'var(--text)',marginBottom:'2px'}}>{r.v} <span style={{color:'var(--text3)',fontWeight:'400',fontFamily:'var(--mono)',fontSize:'10px'}}>· {r.imo}</span></div><div style={{fontSize:'11px',color:'var(--text2)',lineHeight:1.5}}>{r.d}</div></div>
                    <span className={`badge ${r.r==='CRITICAL'?'b-r':'b-a'}`}>{r.r}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* FLEET DASHBOARD */}
          {page === 'fleet' && (
            <div className="pg active">
              <div className="mg4">
                <div className="met"><div className="m-l">Total YTD</div><div className="m-v">107</div><div className="m-s">Jan–Jun 2026</div></div>
                <div className="met"><div className="m-l" style={{color:'var(--amber2)'}}>Tokyo MOU</div><div className="m-v" style={{color:'var(--amber2)'}}>51</div><div className="m-s">48% of total</div></div>
                <div className="met"><div className="m-l">Paris MOU</div><div className="m-v">25</div><div className="m-s">23% of total</div></div>
                <div className="met"><div className="m-l">AMSA</div><div className="m-v">14</div><div className="m-s">13% of total</div></div>
              </div>
              <div className="two">
                <div className="card"><div className="card-t">Monthly trend</div>
                  {[{m:'January',v:23},{m:'February',v:21},{m:'March',v:19},{m:'April',v:19},{m:'May',v:20},{m:'June',v:5}].map(r => (
                    <div key={r.m} className="bar-r">
                      <div className="bar-l">{r.m}</div>
                      <div className="bar-t"><div className="bar-f" style={{width:`${(r.v/25)*100}%`,background:r.m==='May'?'var(--amber)':'var(--blue)'}}></div></div>
                      <div className="bar-v">{r.v}</div>
                    </div>
                  ))}
                  <div style={{fontSize:'10px',color:'var(--text3)',marginTop:'8px',fontFamily:'var(--mono)'}}>Rate is flat — not improving</div>
                </div>
                <div className="card"><div className="card-t">MoU breakdown</div>
                  {[{n:'Tokyo MOU',v:51,c:'var(--amber)'},{n:'Paris MOU',v:25,c:'var(--blue)'},{n:'AMSA',v:14,c:'var(--green)'},{n:'USCG',v:8,c:'var(--purple)'},{n:'Others',v:9,c:'var(--text3)'}].map(r => (
                    <div key={r.n} className="bar-r">
                      <div className="bar-l">{r.n}</div>
                      <div className="bar-t"><div className="bar-f" style={{width:`${(r.v/55)*100}%`,background:r.c}}></div></div>
                      <div className="bar-v">{r.v}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="card"><div className="card-t">Top detention causes</div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px'}}>
                  {[{c:'ISM Code failure',v:22},{c:'Fire safety systems',v:18},{c:'LSA / emergency equip.',v:15},{c:'Corrosion / maintenance',v:10},{c:'MLC / Manning',v:9},{c:'Navigation / charts',v:8},{c:'Pollution prevention',v:7},{c:'Other',v:18}].map(r => (
                    <div key={r.c} className="bar-r" style={{margin:0}}>
                      <div style={{fontSize:'10px',color:'var(--text3)',width:'150px',flexShrink:0}}>{r.c}</div>
                      <div className="bar-t"><div className="bar-f" style={{width:`${(r.v/25)*100}%`,background:'var(--blue)'}}></div></div>
                      <div className="bar-v">{r.v}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* PSC TRACKER */}
          {page === 'tracker' && (
            <div className="pg active">
              <div style={{display:'flex',gap:'8px',marginBottom:'12px',flexWrap:'wrap'}}>
                <input placeholder="Search vessel or IMO…" style={{padding:'6px 10px',border:'1px solid var(--border2)',borderRadius:'var(--r)',background:'var(--bg3)',color:'var(--text)',fontSize:'11px',fontFamily:'var(--font)',outline:'none',width:'180px'}} />
                <select style={{padding:'6px 10px',border:'1px solid var(--border2)',borderRadius:'var(--r)',background:'var(--bg3)',color:'var(--text)',fontSize:'11px',outline:'none'}}>
                  <option>All MoUs</option><option>Tokyo MOU</option><option>Paris MOU</option><option>AMSA</option><option>USCG</option>
                </select>
                <select style={{padding:'6px 10px',border:'1px solid var(--border2)',borderRadius:'var(--r)',background:'var(--bg3)',color:'var(--text)',fontSize:'11px',outline:'none'}}>
                  <option>All owners</option><option>Case Owner A</option><option>Case Owner B</option><option>Case Owner C</option>
                </select>
              </div>
              <table className="tbl">
                <thead><tr><th>Vessel</th><th>Date</th><th>Port · MoU</th><th>Defs</th><th>Owner</th><th>CAR</th><th>Status</th></tr></thead>
                <tbody>
                  {[
                    { v:'OCEAN GALAXY', imo:'9852705', d:'28 May', p:'Tauranga, NZ', m:'Tokyo MOU', defs:14, o:'Case Owner A', car:'Complete', s:'Pending Review', flag:true },
                    { v:'CAPE MIRON', imo:'9545168', d:'29 May', p:'Quebec, CA', m:'Paris MOU', defs:16, o:'Case Owner C', car:'Complete', s:'—', flag:false },
                    { v:'SOPOT', imo:'9727522', d:'27 May', p:'New Haven, US', m:'USCG', defs:3, o:'Case Owner A', car:'Not Received', s:'Pending Review', flag:false },
                    { v:'MORNING CLOUD', imo:'9532197', d:'26 May', p:'Guangzhou, CN', m:'Tokyo MOU', defs:8, o:'Case Owner C', car:'Not Received', s:'Pending CAR', flag:false },
                    { v:'SVR MERCURY', imo:'8822600', d:'26 May', p:'Vasto, IT', m:'Paris MOU', defs:13, o:'Case Owner A', car:'Complete', s:'Close Case', flag:false },
                    { v:'SEALAND LOS ANGELES', imo:'9383235', d:'25 May', p:'Balboa, PA', m:'Tokyo MOU', defs:9, o:'Case Owner B', car:'Not Received', s:'—', flag:false },
                    { v:'AMI', imo:'9303833', d:'25 May', p:'Guangzhou, CN', m:'Tokyo MOU', defs:8, o:'Case Owner A', car:'Complete', s:'Close Case', flag:false },
                    { v:'MARIELENA', imo:'9376359', d:'25 May', p:'Newcastle, AU', m:'AMSA', defs:5, o:'Case Owner B', car:'Not Received', s:'Requested', flag:false },
                    { v:'LFG PRIDE', imo:'9605736', d:'12 May', p:'Tanjung Priok, ID', m:'Tokyo MOU', defs:23, o:'Case Owner B', car:'Complete', s:'Close Case', flag:false },
                    { v:'EVELPIS', imo:'9548158', d:'9 May', p:'Burgas, BG', m:'Paris MOU', defs:17, o:'Case Owner B', car:'Not Received', s:'Requested', flag:false },
                    { v:'ILIANA', imo:'9490715', d:'5 May', p:'Constanta, RO', m:'Paris MOU', defs:11, o:'Case Owner A', car:'Complete', s:'Pending Review', flag:false },
                    { v:'MILESTONE', imo:'9469003', d:'1 May', p:'Newcastle, AU', m:'AMSA', defs:15, o:'Case Owner A', car:'Complete', s:'Pending Review', flag:false },
                  ].map((r,i) => (
                    <tr key={i} style={r.flag ? {borderLeft:'2px solid var(--red)'} : {}}>
                      <td><strong style={r.flag?{color:'var(--red2)'}:{}}>{r.v}</strong><div style={{fontSize:'9px',color:'var(--text3)',fontFamily:'var(--mono)'}}>{r.imo}</div></td>
                      <td style={{fontFamily:'var(--mono)',fontSize:'10px'}}>{r.d}</td>
                      <td><div style={{fontSize:'10px'}}>{r.p}</div><div style={{fontSize:'9px',color:'var(--text3)'}}>{r.m}</div></td>
                      <td><span style={{fontSize:'15px',fontWeight:'300',fontFamily:'var(--mono)',color:r.defs>=15?'var(--red2)':r.defs>=8?'var(--amber2)':'var(--green2)'}}>{r.defs}</span></td>
                      <td style={{fontSize:'10px'}}>{r.o}</td>
                      <td><span className={`badge ${r.car==='Complete'?'b-g':'b-r'}`} style={{fontSize:'9px'}}>{r.car}</span></td>
                      <td><span className={`badge ${r.s==='Close Case'?'b-g':r.s==='—'?'b-gr':'b-a'}`} style={{fontSize:'9px'}}>{r.s}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* AI CHAT */}
          {page === 'chat' && (
            <div className="pg active" style={{display:'flex',flexDirection:'column',height:'calc(100vh - 46px)'}}>
              <div style={{flex:1,overflowY:'auto',padding:'12px',display:'flex',flexDirection:'column',gap:'8px'}}>
                <div className="ch">
                  {chatMessages.map((m,i) => (
                    <div key={i} className={`msg ${m.role==='ai'?'mai':'mur'}`}>
                      <div className="m-lbl">{m.role==='ai'?'LISCR Intelligence':'You'}</div>
                      <div className="mb" style={{whiteSpace:'pre-wrap'}}>{m.text}</div>
                    </div>
                  ))}
                  {chatLoading && <div className="msg mai"><div className="m-lbl">LISCR Intelligence</div><div className="mb" style={{color:'var(--text3)'}}>Analyzing…</div></div>}
                  <div ref={messagesEndRef}></div>
                </div>
              </div>
              <div style={{padding:'10px 12px',borderTop:'1px solid var(--border)',background:'var(--bg2)'}}>
                <div style={{display:'flex',gap:'6px',flexWrap:'wrap',marginBottom:'8px'}}>
                  {['Full EVP briefing','OCEAN GALAXY status','8 structural gaps','Detention trend','Biggest impact change'].map(q => (
                    <button key={q} className="qb" onClick={() => sendChat(q)}>{q}</button>
                  ))}
                </div>
                <div style={{display:'flex',gap:'8px'}}>
                  <input className="ch-inp" placeholder="Ask about fleet performance, specific vessels, decisions needed…" value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key==='Enter' && sendChat()} />
                  <button className="btn btn-primary" onClick={() => sendChat()} disabled={chatLoading} style={{whiteSpace:'nowrap'}}>Send</button>
                </div>
              </div>
            </div>
          )}
          {page === "ais" && <AISMonitor />}
          {page === "inspector" && <InspectorNetwork />}
          {page === "vip" && <VIPProtocol />}
          {page === "meeting" && <MeetingMinutes />}
          {page === "initiatives" && <InitiativeTracker />}
          {page === "patterns" && <PatternDetection />}
          {page === "admin" && <AdminPanel />}

        </div>
      </div>
    </div>
  );
}
