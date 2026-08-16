import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  ArrowRight, Check, ChevronRight, CircleAlert, Code2, Download,
  FileCode2, FileText, KeyRound, LoaderCircle, LockKeyhole, RotateCcw, Save, ShieldCheck, Sparkles, Target,
} from 'lucide-react';
import './styles.css';

const SAMPLE_JD = `We are looking for a Product Analyst who can partner with product and engineering teams, define KPIs, build dashboards, run experiments, and turn complex data into clear recommendations. Strong SQL, Python, stakeholder management, A/B testing, and data visualization skills are required.`;
const AUTH_TOKEN_KEY = 'resumatch-tab-token';

function App() {
  const [authState, setAuthState] = useState('checking');
  const [template, setTemplate] = useState('');
  const [jd, setJd] = useState('');
  const [result, setResult] = useState(null);
  const [pdfUrl, setPdfUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('preview');

  useEffect(() => {
    const token = sessionStorage.getItem(AUTH_TOKEN_KEY);
    if (!token) { setAuthState('locked'); return; }
    fetch('/api/auth/status', { headers: { Authorization: `Bearer ${token}` } })
      .then(res => {
        if (!res.ok) throw new Error('Session expired');
        setAuthState('unlocked');
      })
      .catch(() => { sessionStorage.removeItem(AUTH_TOKEN_KEY); setAuthState('locked'); });
  }, []);

  useEffect(() => {
    if (authState !== 'unlocked') return;
    authorizedFetch('/api/template').then(r => r.json()).then(data => setTemplate(data.latex || '')).catch(() => {});
  }, [authState]);

  useEffect(() => () => { if (pdfUrl) URL.revokeObjectURL(pdfUrl); }, [pdfUrl]);

  const hasTemplate = template.trim().length > 80;
  const canTailor = hasTemplate && jd.trim().length > 80 && !busy;
  const scoreColor = (result?.score || 0) >= 80 ? 'good' : (result?.score || 0) >= 60 ? 'mid' : 'low';

  async function authorizedFetch(url, options = {}) {
    const token = sessionStorage.getItem(AUTH_TOKEN_KEY);
    const res = await fetch(url, { ...options, headers: { ...(options.headers || {}), Authorization: `Bearer ${token || ''}` } });
    if (res.status === 401) {
      sessionStorage.removeItem(AUTH_TOKEN_KEY);
      setAuthState('locked');
      throw new Error('This tab is locked. Enter the password again.');
    }
    return res;
  }

  async function unlock(password) {
    const res = await fetch('/api/auth/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Incorrect password.');
    sessionStorage.setItem(AUTH_TOKEN_KEY, data.token);
    setAuthState('unlocked');
  }

  async function saveTemplate() {
    setSaving(true); setError('');
    try {
      const res = await authorizedFetch('/api/template', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ latex: template }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not save template');
    } catch (e) { setError(e.message); } finally { setSaving(false); }
  }

  async function tailor() {
    setBusy(true); setError(''); setResult(null); setPdfUrl('');
    try {
      const res = await authorizedFetch('/api/tailor', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jobDescription: jd, latex: template }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Tailoring failed');
      setResult(data); setTab('preview');
      if (data.pdfAvailable) await compile(data.latex, false);
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }

  async function compile(latex = result?.latex, download = false) {
    setError('');
    const res = await authorizedFetch('/api/compile', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ latex }) });
    if (!res.ok) { const data = await res.json(); throw new Error(data.error || 'PDF compilation failed'); }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    setPdfUrl(url);
    if (download) { const a = document.createElement('a'); a.href = url; a.download = 'tailored-resume.pdf'; a.click(); }
  }

  const stats = useMemo(() => result ? [
    ['Keyword coverage', `${result.breakdown.keywordCoverage}%`],
    ['Core requirements', `${result.breakdown.requirementCoverage}%`],
    ['ATS structure', `${result.breakdown.structure}%`],
  ] : [], [result]);

  if (authState !== 'unlocked') return <Gate checking={authState === 'checking'} onUnlock={unlock}/>;

  return <div className="app-shell">
    <header className="topbar">
      <a className="brand" href="#"><span className="brand-mark"><FileText size={17}/></span>resumatch</a>
      <span className="private-note"><span/> Uses your private API connection</span>
    </header>

    <main>
      <section className="hero">
        <div className="eyebrow"><Sparkles size={14}/> LaTeX résumé tailoring</div>
        <h1>Your experience.<br/><em>Their language.</em></h1>
        <p>Turn one trusted résumé into a role-specific application—without changing its design or inventing a single claim.</p>
      </section>

      <div className="steps">
        <span className="active"><b>1</b> Add résumé</span><ChevronRight/><span><b>2</b> Paste job</span><ChevronRight/><span><b>3</b> Review & export</span>
      </div>

      <section className="workspace">
        <aside className="input-panel">
          <div className="panel-heading"><span>Source material</span><small>Saved between sessions</small></div>
          <label className="field-label"><span><FileCode2 size={15}/> Master LaTeX</span><small>Set once</small></label>
          <textarea className="code-input" value={template} onChange={e => setTemplate(e.target.value)} placeholder={'Paste your complete Overleaf .tex source here…\n\n\\documentclass{article}\n…'} spellCheck="false"/>
          <button className="save-button" onClick={saveTemplate} disabled={!hasTemplate || saving}>
            {saving ? <LoaderCircle className="spin" size={15}/> : <Save size={15}/>} {saving ? 'Saving…' : 'Save master résumé'}
          </button>

          <div className="divider"><span>tailor for</span></div>
          <label className="field-label"><span><Target size={15}/> Job description</span><small>{jd.length.toLocaleString()} chars</small></label>
          <textarea className="jd-input" value={jd} onChange={e => setJd(e.target.value)} placeholder="Paste the complete job description…"/>
          {!jd && <button className="sample-link" onClick={() => setJd(SAMPLE_JD)}>Try a sample job description</button>}
          <button className="primary-button" onClick={tailor} disabled={!canTailor}>
            {busy ? <LoaderCircle className="spin" size={18}/> : <Sparkles size={18}/>} {busy ? 'Tailoring résumé…' : 'Tailor my résumé'} {!busy && <ArrowRight size={18}/>}
          </button>
          {error && <div className="error"><CircleAlert size={17}/><span>{error}</span></div>}
          <p className="truth-note"><Check size={14}/> Only wording supported by your original résumé is used.</p>
        </aside>

        <section className="result-panel">
          {!result ? <EmptyState hasTemplate={hasTemplate} busy={busy}/> : <>
            <div className="result-header">
              <div><span className="result-kicker">TAILORED VERSION</span><h2>{result.targetRole}</h2><p>{result.summary}</p></div>
              <div className={`score-ring ${scoreColor}`} style={{'--score': `${result.score * 3.6}deg`}}><div><strong>{result.score}</strong><span>ATS fit</span></div></div>
            </div>
            <div className="metrics">{stats.map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>
            <div className="tabs">
              <button className={tab === 'preview' ? 'active' : ''} onClick={() => setTab('preview')}>PDF preview</button>
              <button className={tab === 'analysis' ? 'active' : ''} onClick={() => setTab('analysis')}>ATS analysis</button>
              <button className={tab === 'changes' ? 'active' : ''} onClick={() => setTab('changes')}>Before &amp; after <span className="tab-count">{result.changes.length}</span></button>
              <button className={tab === 'latex' ? 'active' : ''} onClick={() => setTab('latex')}>LaTeX</button>
            </div>
            <div className="tab-body">
              {tab === 'preview' && (pdfUrl ? <div className="pdf-preview"><a className="mobile-pdf-action" href={pdfUrl} target="_blank" rel="noreferrer"><FileText size={16}/> Open full PDF</a><iframe title="Tailored résumé PDF" src={pdfUrl}/></div> : <CompileNotice result={result} onCompile={() => compile(result.latex).catch(e => setError(e.message))}/>) }
              {tab === 'analysis' && <Analysis result={result}/>}
              {tab === 'changes' && <Changes changes={result.changes}/>}
              {tab === 'latex' && <textarea className="result-code" value={result.latex} onChange={e => setResult({...result, latex: e.target.value})} spellCheck="false"/>}
            </div>
            <div className="actions">
              <button className="secondary-button" onClick={() => { setResult(null); setPdfUrl(''); }}><RotateCcw size={16}/> Start over</button>
              <button className="primary-button download" onClick={() => compile(result.latex, true).catch(e => setError(e.message))}><Download size={17}/> Download PDF</button>
            </div>
          </>}
        </section>
      </section>
    </main>
    <footer>Built for honest, focused applications <span>•</span> Your master résumé never gets overwritten</footer>
  </div>;
}

function Gate({ checking, onUnlock }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function submit(event) {
    event.preventDefault();
    if (!password || submitting) return;
    setSubmitting(true); setError('');
    try { await onUnlock(password); }
    catch (e) { setError(e.message); setPassword(''); }
    finally { setSubmitting(false); }
  }

  return <main className="gate-shell">
    <div className="gate-orb gate-orb-one"/><div className="gate-orb gate-orb-two"/>
    <section className="gate-card">
      <div className="gate-brand"><span className="brand-mark"><FileText size={17}/></span>resumatch</div>
      <div className="gate-icon">{checking ? <LoaderCircle className="spin" size={25}/> : <LockKeyhole size={25}/>}</div>
      <span className="gate-kicker">PRIVATE WORKSPACE</span>
      <h1>{checking ? 'Checking this tab…' : 'Unlock your résumé workspace'}</h1>
      <p>{checking ? 'Confirming your tab session.' : 'Enter the password to access the résumé, job descriptions, and generated files.'}</p>
      {!checking && <form onSubmit={submit}>
        <label htmlFor="workspace-password">Password</label>
        <div className="password-field"><KeyRound size={17}/><input id="workspace-password" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter password" autoComplete="current-password" autoFocus/></div>
        {error && <div className="gate-error" role="alert"><CircleAlert size={15}/>{error}</div>}
        <button className="primary-button gate-button" type="submit" disabled={!password || submitting}>{submitting ? <LoaderCircle className="spin" size={18}/> : <ShieldCheck size={18}/>} {submitting ? 'Checking…' : 'Unlock workspace'} {!submitting && <ArrowRight size={17}/>}</button>
      </form>}
      <div className="gate-session"><span/><strong>Tab-only access</strong> Closing this tab locks the workspace.</div>
    </section>
  </main>;
}

function EmptyState({ hasTemplate, busy }) {
  return <div className="empty-state">
    <div className="paper-stack"><div/><div/><FileText size={44}/></div>
    <h2>{busy ? 'Reading the role…' : 'Your tailored résumé will appear here'}</h2>
    <p>{busy ? 'Matching the JD to evidence in your résumé and preserving your LaTeX structure.' : hasTemplate ? 'Paste a job description, then tailor when you’re ready.' : 'Start by adding the complete LaTeX source from Overleaf.'}</p>
    <div className="empty-points"><span><Check/> Design preserved</span><span><Check/> Claims grounded</span><span><Check/> PDF ready</span></div>
  </div>;
}

function CompileNotice({ result, onCompile }) {
  return <div className="compile-notice"><Code2 size={32}/><h3>{result.pdfAvailable ? 'Ready to compile' : 'LaTeX engine not found'}</h3><p>{result.pdfAvailable ? 'Create the PDF preview using your preserved template.' : 'The tailored LaTeX is ready. Install Tectonic or pdfLaTeX on the server, or run the included Docker image, to enable preview and download.'}</p>{result.pdfAvailable && <button className="secondary-button" onClick={onCompile}>Build preview</button>}</div>;
}

function Analysis({ result }) {
  const keywordPoints = Math.round(result.breakdown.keywordCoverage * .45 * 10) / 10;
  const requirementPoints = Math.round(result.breakdown.requirementCoverage * .4 * 10) / 10;
  const structurePoints = Math.round(result.breakdown.structure * .15 * 10) / 10;
  const biggestGap = result.breakdown.requirementCoverage <= result.breakdown.keywordCoverage ? 'core requirements' : 'keyword coverage';
  return <div className="analysis-grid">
    <div className="full score-explainer">
      <div><span className="explain-label">WHY THE SCORE IS {result.score}</span><h3>Matching improves wording—not unsupported experience.</h3><p>Your largest deduction is <strong>{biggestGap}</strong>. Requirements without evidence stay visible as gaps instead of being inserted as claims.</p></div>
      <div className="formula">
        <span><b>{keywordPoints}</b><small>keyword points</small></span><i>+</i>
        <span><b>{requirementPoints}</b><small>requirement points</small></span><i>+</i>
        <span><b>{structurePoints}</b><small>structure points</small></span><i>=</i>
        <span className="formula-total"><b>{result.score}</b><small>total</small></span>
      </div>
    </div>
    <div><h3>Matched keywords <span>{result.matchedKeywords.length}</span></h3><div className="chips">{result.matchedKeywords.map(k => <span className="matched" key={k}>{k}</span>)}</div></div>
    <div><h3>Gaps to validate <span>{result.missingKeywords.length}</span></h3><div className="chips">{result.missingKeywords.map(k => <span className="missing" key={k}>{k}</span>)}</div></div>
    <div className="full caveat"><CircleAlert size={17}/><p><strong>Score is an estimate.</strong> It measures keyword coverage, core requirements, and parse-friendly structure. Employer ATS systems use different rules.</p></div>
  </div>;
}

function Changes({ changes }) {
  if (!changes.length) return <div className="compile-notice"><Code2 size={32}/><h3>No substantive wording changes</h3><p>The source already aligned with this role.</p></div>;
  return <div className="changes-list">
    <div className="changes-intro"><strong>{changes.length} verified edits</strong><span>Layout and factual claims remain intact.</span></div>
    {changes.map((change, index) => <article className="change-card" key={`${change.section}-${index}`}>
      <div className="change-meta"><span>{String(index + 1).padStart(2, '0')}</span><strong>{change.section}</strong><p>{change.reason}</p></div>
      <div className="compare-copy before"><label>Before</label><p>{change.before}</p></div>
      <div className="compare-arrow"><ArrowRight size={16}/></div>
      <div className="compare-copy after"><label>After</label><p>{change.after}</p></div>
    </article>)}
  </div>;
}

createRoot(document.getElementById('root')).render(<App/>);
