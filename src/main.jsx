import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  ArrowRight, Check, ChevronRight, CircleAlert, Code2, Download,
  FileCode2, FileText, LoaderCircle, RotateCcw, Save, Sparkles, Target,
} from 'lucide-react';
import './styles.css';

const SAMPLE_JD = `We are looking for a Product Analyst who can partner with product and engineering teams, define KPIs, build dashboards, run experiments, and turn complex data into clear recommendations. Strong SQL, Python, stakeholder management, A/B testing, and data visualization skills are required.`;
const TEMPLATE_KEY = 'resumatch-master-latex';

// A serverless deployment has no writable disk, so the browser keeps the master
// résumé and sends it with each request. A disk-backed server still wins on load.
function readStoredTemplate() {
  try { return localStorage.getItem(TEMPLATE_KEY) || ''; } catch { return ''; }
}

function storeTemplate(latex) {
  try { localStorage.setItem(TEMPLATE_KEY, latex); } catch { /* storage blocked; the session copy still works */ }
}

function looksLikeLatex(value) { return String(value || '').includes('\\begin{document}'); }

// The API answers in JSON; anything else means the request never reached the Node
// server (a host serving only the built front end returns its own 404 page here).
async function readJson(res) {
  const text = (await res.text()).trim();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    let path = 'the API';
    try { path = new URL(res.url).pathname; } catch { /* keep the generic label */ }
    throw new Error(`${path} answered ${res.status} with a non-JSON response ("${text.slice(0, 40)}…"). The Node API is not being served at /api — start it with "npm run dev" locally, or deploy the server as described in the README.`);
  }
}

function App() {
  const [template, setTemplate] = useState(readStoredTemplate);
  const [jd, setJd] = useState('');
  const [result, setResult] = useState(null);
  const [pdfUrl, setPdfUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('preview');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch('/api/template').then(readJson)
      .then(data => { if (looksLikeLatex(data.latex)) { setTemplate(data.latex); storeTemplate(data.latex); } })
      .catch(() => {});
  }, []);

  useEffect(() => () => { if (pdfUrl) URL.revokeObjectURL(pdfUrl); }, [pdfUrl]);

  const hasTemplate = template.trim().length > 80;
  const canTailor = hasTemplate && jd.trim().length > 80 && !busy;
  const scoreColor = (result?.score || 0) >= 80 ? 'good' : (result?.score || 0) >= 60 ? 'mid' : 'low';

  async function saveTemplate() {
    setSaving(true); setError('');
    try {
      const res = await fetch('/api/template', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ latex: template }) });
      const data = await readJson(res);
      if (!res.ok) throw new Error(data.error || 'Could not save template');
      storeTemplate(template);
    } catch (e) { setError(e.message); } finally { setSaving(false); }
  }

  async function tailor() {
    setBusy(true); setError(''); setResult(null); setPdfUrl(''); setCopied(false);
    try {
      const res = await fetch('/api/tailor', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jobDescription: jd, latex: template }) });
      const data = await readJson(res);
      if (!res.ok) throw new Error(data.error || 'Tailoring failed');
      setResult(data); setTab('preview');
      if (data.pdfAvailable) await compile(data.latex, false);
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }

  async function copyLatex(latex) {
    try { await navigator.clipboard.writeText(latex); setCopied(true); }
    catch { setError('Could not reach the clipboard. Copy the source from the LaTeX tab instead.'); }
  }

  async function compile(latex = result?.latex, download = false) {
    setError('');
    const res = await fetch('/api/compile', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ latex }) });
    if (!res.ok) { const data = await readJson(res); throw new Error(data.error || 'PDF compilation failed'); }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    setPdfUrl(url);
    if (download) { const a = document.createElement('a'); a.href = url; a.download = 'tailored-resume.pdf'; a.click(); }
  }

  const stats = useMemo(() => result ? [
    ['Keyword coverage', `${result.breakdown.keywordCoverage}%`],
    ['JD match', `${result.breakdown.requirementCoverage}%`],
    ['ATS structure', `${result.breakdown.structure}%`],
  ] : [], [result]);

  return <div className="app-shell">
    <header className="topbar">
      <a className="brand" href="#"><span className="brand-mark"><FileText size={17}/></span>resumatch</a>
      <span className="private-note"><span/> Uses your private API connection</span>
    </header>

    <main>
      <section className="hero">
        <div className="eyebrow"><Sparkles size={14}/> LaTeX résumé tailoring</div>
        <h1>Your experience.<br/><em>Their language.</em></h1>
        <p>Turn one trusted résumé into a role-specific application—matched to the role's requirements, with every addition listed for your review.</p>
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
          <p className="truth-note"><Check size={14}/> Added skills are listed for review; degrees, employers, dates and metrics are never invented.</p>
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
              {result.pdfAvailable
                ? <button className="primary-button download" onClick={() => compile(result.latex, true).catch(e => setError(e.message))}><Download size={17}/> Download PDF</button>
                : <button className="primary-button download" onClick={() => copyLatex(result.latex)}>{copied ? <Check size={17}/> : <Code2 size={17}/>} {copied ? 'LaTeX copied' : 'Copy LaTeX for Overleaf'}</button>}
            </div>
          </>}
        </section>
      </section>
    </main>
    <footer>Built for honest, focused applications <span>•</span> Your master résumé never gets overwritten</footer>
  </div>;
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
  return <div className="compile-notice"><Code2 size={32}/><h3>{result.pdfAvailable ? 'Ready to compile' : 'LaTeX engine not found'}</h3><p>{result.pdfAvailable ? 'Create the PDF preview using your preserved template.' : 'The tailored LaTeX is ready. Copy it into Overleaf to produce the PDF, or run Resumatch with Docker for in-app preview and download.'}</p>{result.pdfAvailable && <button className="secondary-button" onClick={onCompile}>Build preview</button>}</div>;
}

function Analysis({ result }) {
  const keywordPoints = Math.round(result.breakdown.keywordCoverage * .45 * 10) / 10;
  const requirementPoints = Math.round(result.breakdown.requirementCoverage * .4 * 10) / 10;
  const structurePoints = Math.round(result.breakdown.structure * .15 * 10) / 10;
  const biggestGap = result.breakdown.requirementCoverage <= result.breakdown.keywordCoverage ? 'core requirements' : 'keyword coverage';
  return <div className="analysis-grid">
    <div className="full score-explainer">
      <div><span className="explain-label">WHY THE SCORE IS {result.score}</span><h3>The résumé now carries the role's requirements.</h3><p>Your largest remaining deduction is <strong>{biggestGap}</strong>. What is left below could not be written in as a skill—degrees, employers and named achievements are never invented.</p></div>
      <div className="formula">
        <span><b>{keywordPoints}</b><small>keyword points</small></span><i>+</i>
        <span><b>{requirementPoints}</b><small>requirement points</small></span><i>+</i>
        <span><b>{structurePoints}</b><small>structure points</small></span><i>=</i>
        <span className="formula-total"><b>{result.score}</b><small>total</small></span>
      </div>
    </div>
    <div><h3>Matched keywords <span>{result.matchedKeywords.length}</span></h3><div className="chips">{result.matchedKeywords.map(k => <span className="matched" key={k}>{k}</span>)}</div></div>
    <div><h3>Still not covered <span>{result.missingKeywords.length}</span></h3><div className="chips">{result.missingKeywords.map(k => <span className="missing" key={k}>{k}</span>)}</div></div>
    {Boolean(result.addedClaims?.length) && <div className="full added-claims">
      <h3>Added for this role — review before sending <span>{result.addedClaims.length}</span></h3>
      <p className="added-note">These went into the résumé but were not in your original. Keep the ones you can speak to in an interview and delete the rest from the LaTeX tab.</p>
      <ul>{result.addedClaims.map((claim, index) => <li key={`${claim.section}-${index}`}>
        <strong>{claim.section}</strong><span>{claim.text}</span><small>covers: {claim.requirement}</small>
      </li>)}</ul>
    </div>}
    <div className="full caveat"><CircleAlert size={17}/><p><strong>Score is an estimate, and the model grades its own output.</strong> It measures keyword coverage, requirement coverage, and parse-friendly structure. Employer ATS systems use different rules, and anything in the added list is yours to stand behind.</p></div>
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
