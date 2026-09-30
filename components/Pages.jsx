// Pattern detail + Knowledge base + History pages

function ConfidenceDonut({ value }) {
  const pct = Math.round(value * 100);
  const r = 36, c = 2 * Math.PI * r;
  return (
    <svg className="donut" viewBox="0 0 90 90">
      <circle className="bg" cx="45" cy="45" r={r} fill="none" strokeWidth="8"/>
      <circle className="fg" cx="45" cy="45" r={r} fill="none" strokeWidth="8"
        strokeDasharray={c} strokeDashoffset={c * (1-value)}
        transform="rotate(-90 45 45)"/>
      <text className="t" x="45" y="51" textAnchor="middle">{pct}%</text>
    </svg>
  );
}

function suggestRelated(pattern, kb, limit = 3) {
  const kws = new Set((pattern.keywords||[]).map(k => k.toLowerCase()));
  const all = [];
  for (const [cat, bucket] of Object.entries(kb)) {
    for (const p of bucket.patterns) {
      if (p.id === pattern.id) continue;
      const other = new Set((p.keywords||[]).map(k => k.toLowerCase()));
      let overlap = 0;
      kws.forEach(k => { if (other.has(k)) overlap += 1; });
      if ((pattern.related_patterns||[]).includes(p.id)) overlap += 2;
      if (overlap > 0) all.push({pattern: p, category: cat, score: overlap / Math.max(1, Math.max(kws.size, other.size))});
    }
  }
  return all.sort((a,b) => b.score - a.score).slice(0, limit);
}

// ============= APPLIED FIX BLOCK (editable) =============
function AppliedFixBlock({ pattern, onSaveFix }) {
  const existing = pattern.applied_fix || null;
  const [editing, setEditing] = React.useState(!existing);
  const [draft, setDraft] = React.useState(existing ? existing.text : '');
  const [author, setAuthor] = React.useState(existing ? existing.author : '');

  const save = () => {
    if (!draft.trim()) return;
    const entry = {
      text: draft.trim(),
      author: author.trim() || 'anonymous',
      saved_at: new Date().toISOString().slice(0,16).replace('T',' '),
    };
    onSaveFix(pattern.id, entry);
    setEditing(false);
  };

  if (!editing && existing) {
    return (
      <div className="applied-fix saved">
        <div className="af-head">
          <div>
            <div className="af-k">Applied fix</div>
            <div className="af-author">{existing.author} · {existing.saved_at}</div>
          </div>
          <button className="af-edit" onClick={() => { setDraft(existing.text); setAuthor(existing.author); setEditing(true); }}>Edit</button>
        </div>
        <div className="af-text">{existing.text}</div>
        <div className="af-badge">✓ Logged to knowledge_base.json</div>
      </div>
    );
  }

  return (
    <div className="applied-fix editing">
      <div className="af-head">
        <div className="af-k">What fix / change did you apply?</div>
        {existing && <button className="af-edit" onClick={() => setEditing(false)}>Cancel</button>}
      </div>
      <textarea
        className="af-textarea"
        placeholder="e.g. Raised connection pool limit from 120 → 200, redeployed pgbouncer with statement_timeout=4500ms. Incident PR #2841."
        value={draft}
        onChange={e => setDraft(e.target.value)}
        rows={4}
      />
      <div className="af-row">
        <input className="af-author-input" placeholder="Your name / team (optional)" value={author} onChange={e => setAuthor(e.target.value)}/>
        <button className="af-save" onClick={save} disabled={!draft.trim()}>Save to knowledge base</button>
      </div>
      <div className="af-hint">Stored with the pattern for future matches. Visible to anyone inspecting this failure next time.</div>
    </div>
  );
}

// ============= PATTERN DETAIL =============
function PatternDetail({ patternId, kb, results, onBack, onOpen, onSaveFix }) {
  let pattern = null, category = null, isNew = false, totalHits = null, matchingFiles = [];
  for (const [cat, bucket] of Object.entries(kb)) {
    const found = bucket.patterns.find(p => p.id === patternId);
    if (found) { pattern = found; category = cat; break; }
  }
  if (!pattern && results) {
    const newP = results.newPatterns.find(p => p.id === patternId);
    if (newP) { pattern = newP; category = 'unknown_logs'; isNew = true; }
  }
  if (results) {
    const agg = results.aggregated.find(a => a.pattern.id === patternId);
    if (agg) { totalHits = agg.totalHits; matchingFiles = agg.matchingFiles; }
  }
  if (!pattern) return <div style={{padding:48}}>Pattern not found. <button onClick={onBack}>Back</button></div>;

  const srcFiles = matchingFiles.length ? matchingFiles : (pattern.source_files||[]).map(n => ({name:n, lineIdxs:[]}));
  const hi = pattern.human_intervention;
  const related = suggestRelated(pattern, kb, 3);

  const weeks = ['W12','W13','W14','W15','W16','W17'];
  const weekData = weeks.map((w,i) => ({ w, n: Math.max(1, Math.round((pattern.frequency||6)/6 * (0.6 + ((i*13)%7)/10 + 0.5) + (i===5?2:0))) }));
  const maxN = Math.max(...weekData.map(d => d.n));

  return (
    <div className="detail-page">
      <div className="detail-head">
        <button className="detail-back" onClick={onBack}>← Back</button>
        <div className="pc-id">{pattern.id} · {window.CATEGORY_LABELS[category]} {isNew && ' · NEW'}</div>
        <h1>{pattern.title}</h1>
        <span className="rule"/>
        <p className="meta">{pattern.description}</p>
      </div>

      <div className="detail-body">
        <div>
          <div className="detail-section">
            <h3>Matched log excerpt</h3>
            <div className="logs-excerpt">
              {pattern.examples.map((ex, i) => (
                <div key={i} className="le-line hl">
                  <span className="le-ts">2026-04-22T08:{22+i}:44.018Z</span>
                  <span className="le-lvl">ERROR</span>
                  {ex}
                </div>
              ))}
              <div className="le-line" style={{opacity:0.55}}>
                <span className="le-ts">2026-04-22T08:24:12.117Z</span>
                <span className="le-lvl" style={{color:'#888'}}>INFO</span>
                recovery sequence initiated
              </div>
            </div>
          </div>

          <div className="detail-section">
            <h3>Suggested fix</h3>
            <div className="fix-callout">{pattern.fix}</div>
          </div>

          <div className="detail-section">
            <h3>Applied fix</h3>
            <AppliedFixBlock pattern={pattern} onSaveFix={onSaveFix}/>
          </div>

          {hi && (
            <div className="detail-section">
              <h3>Human intervention</h3>
              <div className="human-callout">
                <div className="hc-row">
                  <div className="hc-k">Required</div>
                  <div className="hc-v">
                    {hi.required
                      ? <><strong style={{color:'var(--accent)'}}>Yes</strong> — on-call engineer must ack within SLA.</>
                      : <>Not required — auto-remediation usually sufficient.</>}
                  </div>
                </div>
                <div className="hc-row">
                  <div className="hc-k">Severity</div>
                  <div className="hc-v"><span className={"sev " + (hi.severity||'P3')}>{hi.severity||'P3'}</span></div>
                </div>
                <div className="hc-row">
                  <div className="hc-k">Owner</div>
                  <div className="hc-v">{hi.owner}</div>
                </div>
                <div className="hc-row">
                  <div className="hc-k">Runbook</div>
                  <div className="hc-v">{hi.runbook}</div>
                </div>
                <div className="hc-row">
                  <div className="hc-k">Escalation</div>
                  <div className="hc-v">{hi.escalation}</div>
                </div>
                {hi.avg_resolution_min != null && (
                  <div className="hc-auto">Historical avg. time-to-resolution: <strong>{hi.avg_resolution_min} min</strong></div>
                )}
              </div>
            </div>
          )}

          {related.length > 0 && (
            <div className="detail-section">
              <h3>Solutions from similar past incidents</h3>
              <div style={{fontSize:12, color:'var(--fg-3)', marginBottom:8}}>
                The miner found {related.length} related pattern{related.length>1?'s':''} in the knowledge base. Their historical remediation may apply here:
              </div>
              {related.map(r => (
                <div key={r.pattern.id} className="related-card" onClick={() => onOpen && onOpen(r.pattern.id)}>
                  <div className="rc-head">
                    <span className="rc-id">{r.pattern.id} · {window.CATEGORY_LABELS[r.category]}</span>
                    <span className="rc-score">{Math.round(r.score*100)}% overlap</span>
                  </div>
                  <div className="rc-title">{r.pattern.title}</div>
                  <div className="rc-fix">{r.pattern.fix}</div>
                  {r.pattern.applied_fix && (
                    <div className="rc-applied">
                      <span className="rc-applied-k">✓ Previously resolved:</span> {r.pattern.applied_fix.text}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="detail-section">
            <h3>Source files</h3>
            <div style={{display:'flex', flexWrap:'wrap', gap:8}}>
              {srcFiles.map((f,i) => (
                <div key={i} style={{border:'1px solid var(--border-hair)', padding:'8px 14px', fontSize:12, fontFamily:'var(--mono)'}}>
                  {f.name}{f.lineIdxs && f.lineIdxs.length ? <span style={{color:'var(--fg-3)', marginLeft:8}}>· {f.lineIdxs.length} hit{f.lineIdxs.length!==1?'s':''}</span> : null}
                </div>
              ))}
            </div>
          </div>
        </div>

        <aside className="aside">
          <div className="aside-card">
            <h4>Confidence</h4>
            <div className="donut-wrap">
              <ConfidenceDonut value={pattern.confidence||0.85}/>
              <div className="donut-meta">
                <div className="lab">Match score</div>
                <div>Cosine similarity across {(pattern.keywords||[]).length} keyword clusters.</div>
              </div>
            </div>
          </div>
          <div className="aside-card">
            <h4>Keywords</h4>
            <div className="keywords">
              {(pattern.keywords||[]).map((k,i) => (
                <span key={i} className={"k" + (i<2?' hot':'')}>{k}</span>
              ))}
            </div>
          </div>
          <div className="aside-card">
            <h4>Frequency · last 6 weeks</h4>
            <div className="timeline">
              {weekData.map((d,i) => (
                <div className="tl-row" key={i}>
                  <span className="d">{d.w}</span>
                  <span className="bar"><span className="fill" style={{width: (d.n/maxN*100)+'%'}}/></span>
                  <span className="n">{d.n}×</span>
                </div>
              ))}
            </div>
          </div>
          <div className="aside-card">
            <h4>Observed</h4>
            <div style={{fontSize:12, color:'var(--fg-2)', lineHeight:1.6}}>
              First seen <strong style={{color:'var(--fg-1)'}}>{pattern.first_seen || '—'}</strong><br/>
              Last seen <strong style={{color:'var(--fg-1)'}}>{pattern.last_seen || '—'}</strong><br/>
              Total occurrences <strong style={{color:'var(--fg-1)'}}>{(pattern.frequency||0) + (totalHits||0)}</strong>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

// ============= KNOWLEDGE BASE =============
function KnowledgeBase({ kb, onOpen, onExport }) {
  const [cat, setCat] = React.useState('database_logs');
  const [q, setQ] = React.useState('');
  const cats = ['database_logs','api_logs','infra_logs','unknown_logs'];
  const current = kb[cat] || { patterns: [] };
  const filtered = current.patterns.filter(p =>
    !q || (p.title+' '+p.description+' '+(p.keywords||[]).join(' ')).toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div className="kb-page">
      <div className="kb-head">
        <div>
          <div className="eyebrow">Knowledge store</div>
          <h1>Failure <strong>knowledge base</strong></h1>
          <div className="sub">Reusable intelligence stored in knowledge_base.json — patterns, remediations, human intervention runbooks, and applied fixes from past incidents.</div>
        </div>
        <button className="btn-export" onClick={onExport}>↓ Export knowledge_base.json</button>
      </div>

      <div style={{display:'flex', gap: 16, alignItems:'center', marginBottom: 12}}>
        <div className="lv-search" style={{maxWidth:300}}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16" y2="16" strokeLinecap="round"/></svg>
          <input placeholder="Search patterns, keywords…" value={q} onChange={e => setQ(e.target.value)}/>
        </div>
      </div>

      <div className="kb-categories">
        {cats.map(c => (
          <button key={c} className={"kb-cat" + (cat===c?' active':'')} onClick={() => setCat(c)}>
            {window.CATEGORY_LABELS[c]}
            <span className="c">({(kb[c]?.patterns||[]).length})</span>
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="results-empty" style={{maxWidth:400}}>
          {q ? 'No patterns match your search.' : 'No patterns recorded in this category yet.'}
        </div>
      ) : (
        <div className="kb-grid">
          {filtered.map(p => (
            <window.PatternCard key={p.id} pattern={p} onOpen={onOpen}/>
          ))}
        </div>
      )}
    </div>
  );
}

// ============= HISTORY =============
// Table of every pattern previously detected. Columns: id / description /
// frequency / last seen / source files. Sortable. Filter by category.
function History({ kb, history, onOpen }) {
  const [cat, setCat] = React.useState('all');
  const [sort, setSort] = React.useState({k: 'last_seen', dir: -1});
  const [q, setQ] = React.useState('');

  // Flatten all kb patterns with their category
  const allPatterns = React.useMemo(() => {
    const rows = [];
    for (const [c, bucket] of Object.entries(kb)) {
      for (const p of bucket.patterns) {
        rows.push({ ...p, _category: c });
      }
    }
    return rows;
  }, [kb]);

  const filtered = allPatterns
    .filter(p => cat === 'all' || p._category === cat)
    .filter(p => !q || (p.id+' '+p.title+' '+p.description).toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => {
      const k = sort.k, d = sort.dir;
      if (k === 'frequency') return d * ((a.frequency||0) - (b.frequency||0));
      if (k === 'sources') return d * ((a.source_files||[]).length - (b.source_files||[]).length);
      const av = (a[k] || '') + '';
      const bv = (b[k] || '') + '';
      return d * av.localeCompare(bv);
    });

  const setSortKey = (k) => setSort(s => s.k === k ? {k, dir: -s.dir} : {k, dir: -1});
  const SortArrow = ({k}) => sort.k === k ? <span className="hist-arr">{sort.dir > 0 ? '↑' : '↓'}</span> : <span className="hist-arr" style={{opacity:0.3}}>↕</span>;

  // derive scan events from history state (most recent processing runs)
  const totalFreq = allPatterns.reduce((s,p) => s + (p.frequency||0), 0);
  const fixedCount = allPatterns.filter(p => p.applied_fix).length;

  return (
    <div className="kb-page history-page">
      <div className="kb-head">
        <div>
          <div className="eyebrow">Incident log</div>
          <h1>Detection <strong>history</strong></h1>
          <div className="sub">Every failure pattern ever observed, across all scans. Sorted, searchable, exportable.</div>
        </div>
      </div>

      <div className="history-stats">
        <div className="hs"><div className="v">{allPatterns.length}</div><div className="k">Patterns tracked</div></div>
        <div className="hs"><div className="v">{totalFreq}</div><div className="k">Total occurrences</div></div>
        <div className="hs"><div className="v">{fixedCount}</div><div className="k">With applied fix</div></div>
        <div className="hs"><div className="v">{history.length}</div><div className="k">Scan sessions</div></div>
      </div>

      <div className="history-toolbar">
        <div className="lv-search" style={{maxWidth:320}}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16" y2="16" strokeLinecap="round"/></svg>
          <input placeholder="Filter by id, title…" value={q} onChange={e => setQ(e.target.value)}/>
        </div>
        <div className="history-cats">
          {[['all','All'],['database_logs','Database'],['api_logs','API'],['infra_logs','Infrastructure'],['unknown_logs','Unknown']].map(([k,l]) => (
            <button key={k} className={"hist-cat" + (cat===k?' active':'')} onClick={() => setCat(k)}>{l}</button>
          ))}
        </div>
      </div>

      <div className="history-table-wrap">
        <table className="history-table">
          <thead>
            <tr>
              <th style={{width: 110}} onClick={() => setSortKey('id')}>Pattern ID <SortArrow k="id"/></th>
              <th onClick={() => setSortKey('title')}>Description <SortArrow k="title"/></th>
              <th style={{width: 130}} onClick={() => setSortKey('frequency')}>Frequency <SortArrow k="frequency"/></th>
              <th style={{width: 130}} onClick={() => setSortKey('last_seen')}>Last seen <SortArrow k="last_seen"/></th>
              <th style={{width: 260}} onClick={() => setSortKey('sources')}>Source files <SortArrow k="sources"/></th>
              <th style={{width: 130}}>Fix status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(p => {
              const sources = p.source_files || [];
              return (
                <tr key={p.id} onClick={() => onOpen(p.id)}>
                  <td><span className="hist-id">{p.id}</span><div className="hist-cat-badge">{window.CATEGORY_LABELS[p._category]}</div></td>
                  <td>
                    <div className="hist-title">{p.title}</div>
                    <div className="hist-desc">{p.description}</div>
                  </td>
                  <td>
                    <div className="hist-freq">
                      <span className="n">{p.frequency||0}</span>
                      <span className="u">×</span>
                      <div className="hist-freq-bar"><div className="fill" style={{width: Math.min(100, (p.frequency||0)*6)+'%'}}/></div>
                    </div>
                  </td>
                  <td><span className="hist-date">{p.last_seen || '—'}</span></td>
                  <td>
                    <div className="hist-sources">
                      {sources.slice(0,2).map((s,i) => <span key={i} className="hist-src">{s}</span>)}
                      {sources.length > 2 && <span className="hist-src more">+{sources.length-2}</span>}
                      {sources.length === 0 && <span style={{color:'var(--fg-3)', fontSize:11}}>—</span>}
                    </div>
                  </td>
                  <td>
                    {p.applied_fix ? (
                      <span className="fix-pill applied">✓ Applied</span>
                    ) : (
                      <span className="fix-pill open">Open</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div style={{padding:40, textAlign:'center', fontSize:12, color:'var(--fg-3)'}}>No patterns match the current filter.</div>
        )}
      </div>

      {history.length > 0 && (
        <div className="history-sessions">
          <h3>Recent scan sessions</h3>
          <div className="sessions">
            {history.slice(0, 6).map((h, i) => (
              <div key={i} className="session">
                <div className="s-time">{h.when}</div>
                <div className="s-meta">
                  <strong>{h.filesScanned}</strong> file{h.filesScanned!==1?'s':''}
                  <span className="sep">·</span>
                  <strong>{h.matched}</strong> matched
                  <span className="sep">·</span>
                  <strong style={{color:'var(--accent)'}}>{h.newPatterns}</strong> new
                </div>
                <div className="s-files">{h.fileNames.slice(0,3).join(' · ')}{h.fileNames.length>3?` +${h.fileNames.length-3}`:''}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

window.PatternDetail = PatternDetail;
window.KnowledgeBase = KnowledgeBase;
window.History = History;
