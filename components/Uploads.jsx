// Uploads tab — detailed, interactive view of every ingest session + files.
// Inspired by the History view but richer: expandable cards, level breakdowns,
// sparkline of errors-over-lines, per-file drill-down.

function Sparkline({ values, color = 'var(--accent)', width = 120, height = 28 }) {
  if (!values.length) return null;
  const max = Math.max(1, ...values);
  const step = width / Math.max(1, values.length - 1);
  const pts = values.map((v, i) => `${i*step},${height - (v/max)*height}`).join(' ');
  const area = `0,${height} ${pts} ${width},${height}`;
  return (
    <svg className="sparkline" viewBox={`0 0 ${width} ${height}`} width={width} height={height}>
      <polygon points={area} fill={color} opacity="0.12"/>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5"/>
    </svg>
  );
}

function levelBreakdown(lines) {
  const c = { ERROR:0, FATAL:0, WARN:0, INFO:0, DEBUG:0, TRACE:0 };
  lines.forEach(l => { if (c[l.level] != null) c[l.level]++; });
  return c;
}

function errorBuckets(lines, buckets = 20) {
  const arr = new Array(buckets).fill(0);
  if (!lines.length) return arr;
  lines.forEach((l, i) => {
    if (l.level === 'ERROR' || l.level === 'FATAL' || l.level === 'WARN') {
      const b = Math.min(buckets-1, Math.floor(i/lines.length*buckets));
      arr[b]++;
    }
  });
  return arr;
}

function formatBytes(n) {
  if (!n && n !== 0) return '—';
  if (n < 1024) return n + ' B';
  if (n < 1024*1024) return (n/1024).toFixed(1) + ' KB';
  return (n/1024/1024).toFixed(2) + ' MB';
}

function UploadsPage({ files, history, kb, onOpenPattern, onRemove }) {
  const [tab, setTab] = React.useState('active');  // active | sessions
  const [expanded, setExpanded] = React.useState({});
  const [sort, setSort] = React.useState({ key: 'name', dir: 'asc' });
  const [query, setQuery] = React.useState('');

  const toggle = (id) => setExpanded(e => ({...e, [id]: !e[id]}));

  // Enrich files with derived stats + kb matches
  const enriched = React.useMemo(() => files.map(f => {
    const breakdown = levelBreakdown(f.lines);
    const matches = window.PatternEngine.matchAgainstKB(f.lines, kb, 0.5);
    return {
      ...f,
      breakdown,
      errorPct: f.lines.length ? ((breakdown.ERROR + breakdown.FATAL) / f.lines.length * 100) : 0,
      matches: matches.matches,
      matchCount: matches.matches.length,
      matchedLineCount: matches.matches.reduce((s,m) => s + m.matchedLineIdxs.length, 0),
      sparks: errorBuckets(f.lines, 20),
      firstTs: f.lines[0]?.ts || '—',
      lastTs: f.lines[f.lines.length-1]?.ts || '—',
    };
  }), [files, kb]);

  const filtered = enriched.filter(f => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return f.name.toLowerCase().includes(q) || (f.type||'').toLowerCase().includes(q);
  });

  const sorted = [...filtered].sort((a, b) => {
    const dir = sort.dir === 'asc' ? 1 : -1;
    const av = a[sort.key], bv = b[sort.key];
    if (typeof av === 'string') return av.localeCompare(bv) * dir;
    return ((av||0) - (bv||0)) * dir;
  });

  const sortBy = (key) => setSort(s => s.key === key
    ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' }
    : { key, dir: 'desc' });
  const arr = (key) => sort.key === key ? (sort.dir === 'asc' ? '↑' : '↓') : '';

  // Aggregate stats
  const totals = enriched.reduce((acc, f) => ({
    files: acc.files + 1,
    lines: acc.lines + f.lines.length,
    errors: acc.errors + f.breakdown.ERROR + f.breakdown.FATAL,
    warns: acc.warns + f.breakdown.WARN,
    matches: acc.matches + f.matchCount,
    size: acc.size + (f.size || 0),
  }), { files: 0, lines: 0, errors: 0, warns: 0, matches: 0, size: 0 });

  return (
    <div className="uploads-page">
      <div className="kb-hero">
        <div className="eyebrow">Ingest</div>
        <h1>Upload <strong>history</strong></h1>
        <p>Every log file ingested by Trace Miner, with level breakdowns, pattern matches, and session metadata. Expand any row for per-file drill-down.</p>
      </div>

      <div className="up-stats">
        <div className="up-stat"><div className="v">{totals.files}</div><div className="k">Files</div></div>
        <div className="up-stat"><div className="v">{totals.lines.toLocaleString()}</div><div className="k">Lines</div></div>
        <div className="up-stat"><div className="v" style={{color:'var(--accent)'}}>{totals.errors}</div><div className="k">Errors</div></div>
        <div className="up-stat"><div className="v" style={{color:'#B88100'}}>{totals.warns}</div><div className="k">Warnings</div></div>
        <div className="up-stat"><div className="v">{totals.matches}</div><div className="k">Pattern hits</div></div>
        <div className="up-stat"><div className="v">{formatBytes(totals.size)}</div><div className="k">Total size</div></div>
      </div>

      <div className="up-tabs">
        <button className={"up-tab" + (tab==='active'?' active':'')} onClick={() => setTab('active')}>
          Active files <span className="badge">{files.length}</span>
        </button>
        <button className={"up-tab" + (tab==='sessions'?' active':'')} onClick={() => setTab('sessions')}>
          Scan sessions <span className="badge">{history.length}</span>
        </button>
      </div>

      {tab === 'active' && (
        <>
          <div className="up-toolbar">
            <div className="up-search">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16" y2="16" strokeLinecap="round"/></svg>
              <input placeholder="Filter by filename or type…" value={query} onChange={e => setQuery(e.target.value)}/>
            </div>
            <div className="up-sort">
              <span className="lbl">Sort:</span>
              <button onClick={() => sortBy('name')} className={sort.key==='name'?'on':''}>Name {arr('name')}</button>
              <button onClick={() => sortBy('lines')} className={sort.key==='lines'?'on':''}>Lines {arr('lines')}</button>
              <button onClick={() => sortBy('errorPct')} className={sort.key==='errorPct'?'on':''}>Error % {arr('errorPct')}</button>
              <button onClick={() => sortBy('matchCount')} className={sort.key==='matchCount'?'on':''}>Matches {arr('matchCount')}</button>
            </div>
          </div>

          {sorted.length === 0 && (
            <div className="up-empty">
              No files match. Drop logs on the Miner tab or clear the filter.
            </div>
          )}

          <div className="up-list">
            {sorted.map(f => {
              const isOpen = !!expanded[f.id];
              const totalLvl = Object.values(f.breakdown).reduce((s,v) => s+v, 0) || 1;
              return (
                <div key={f.id} className={"up-card" + (isOpen?' open':'')}>
                  <div className="up-head" onClick={() => toggle(f.id)}>
                    <div className="up-head-left">
                      <span className={`uc-type ${f.type||'unknown'}`}>{(f.type||'??').toUpperCase().slice(0,3)}</span>
                      <div>
                        <div className="up-name">{f.name}</div>
                        <div className="up-meta">
                          {f.lines.length} lines · {formatBytes(f.size)}
                          <span className="sep">·</span>
                          <span style={{fontFamily:'var(--mono)'}}>{f.firstTs.slice(0,10) || '—'}</span>
                        </div>
                      </div>
                    </div>
                    <div className="up-head-right">
                      <div className="uc-kv">
                        <div className="k">Errors</div>
                        <div className="v" style={{color: f.errorPct > 5 ? 'var(--accent)' : 'var(--fg-1)'}}>{f.errorPct.toFixed(1)}%</div>
                      </div>
                      <div className="uc-kv" style={{minWidth: 80}}>
                        <div className="k">Timeline</div>
                        <Sparkline values={f.sparks}/>
                      </div>
                      <div className="uc-kv">
                        <div className="k">Matches</div>
                        <div className="v" style={{color: f.matchCount > 0 ? 'var(--accent)' : 'var(--fg-3)'}}>{f.matchCount}</div>
                      </div>
                      <button className="uc-expand" aria-label="Toggle">
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" style={{transform: isOpen?'rotate(180deg)':'none', transition:'transform 220ms'}}><polyline points="6 9 12 15 18 9"/></svg>
                      </button>
                    </div>
                  </div>

                  {isOpen && (
                    <div className="up-body">
                      <div className="up-body-grid">
                        <div className="up-col">
                          <div className="up-lbl">Level breakdown</div>
                          <div className="up-bar-stack">
                            {['ERROR','FATAL','WARN','INFO','DEBUG'].map(lvl => {
                              const n = f.breakdown[lvl] || 0;
                              if (n === 0) return null;
                              const pct = (n/totalLvl*100).toFixed(1);
                              return (
                                <div key={lvl} className="up-lvl-row">
                                  <span className={"up-lvl-k " + lvl}>{lvl}</span>
                                  <div className="up-lvl-bar">
                                    <div className={"fill " + lvl} style={{width: pct+'%'}}/>
                                  </div>
                                  <span className="up-lvl-n">{n}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        <div className="up-col">
                          <div className="up-lbl">Temporal profile</div>
                          <div className="up-kvs">
                            <div><span>First line</span><b>{f.firstTs || '—'}</b></div>
                            <div><span>Last line</span><b>{f.lastTs || '—'}</b></div>
                            <div><span>Category</span><b>{(window.CATEGORY_LABELS && window.CATEGORY_LABELS[f.type === 'db' ? 'database_logs' : f.type === 'api' ? 'api_logs' : f.type === 'infra' ? 'infra_logs' : 'unknown_logs']) || '—'}</b></div>
                            <div><span>Signatures</span><b>{f.matchedLineCount} lines in {f.matchCount} patterns</b></div>
                          </div>
                        </div>

                        <div className="up-col">
                          <div className="up-lbl">Matched patterns</div>
                          {f.matches.length === 0 && <div className="up-none">No known pattern matched.</div>}
                          <div className="up-match-list">
                            {f.matches.slice(0, 4).map(m => (
                              <div key={m.pattern.id} className="up-match" onClick={() => onOpenPattern(m.pattern.id)}>
                                <div className="up-match-id">{m.pattern.id}</div>
                                <div className="up-match-title">{m.pattern.title}</div>
                                <div className="up-match-meta">
                                  <span>{m.matchedLineIdxs.length} hits</span>
                                  <span className="sep">·</span>
                                  <span>{Math.round(m.confidence*100)}% conf.</span>
                                  <span className="sep">·</span>
                                  <span className="open-link">Open →</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="up-actions">
                        <button className="up-action danger" onClick={(e) => { e.stopPropagation(); onRemove(f.id); }}>Remove from session</button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {tab === 'sessions' && (
        <div className="up-sessions-list">
          {history.length === 0 && (
            <div className="up-empty">No scan sessions yet. Process logs in the Miner tab to populate this.</div>
          )}
          {history.map((s, i) => (
            <div key={i} className="up-session">
              <div className="up-session-head">
                <div>
                  <div className="up-session-when">{s.when}</div>
                  <div className="up-session-meta">
                    <strong>{s.filesScanned}</strong> file{s.filesScanned!==1?'s':''}
                    <span className="sep">·</span>
                    <strong>{s.matched}</strong> matched
                    <span className="sep">·</span>
                    <strong style={{color:'var(--accent)'}}>{s.newPatterns}</strong> new
                  </div>
                </div>
                <div className="up-session-pill">Scan #{history.length - i}</div>
              </div>
              <div className="up-session-files">
                {(s.fileNames||[]).map((n, j) => (
                  <span key={j} className="up-session-chip">{n}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

window.UploadsPage = UploadsPage;
