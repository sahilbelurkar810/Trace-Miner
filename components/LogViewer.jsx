// LogViewer — full-featured log reader replacing LogExpert:
// search (w/ highlight), level filters, bookmarks, line details,
// pattern-match overlay that links back to KB.

function LogViewer({ files, kb, onOpenPattern, onAddFiles }) {
  const [activeId, setActiveId] = React.useState(files[0]?.id || null);
  const [query, setQuery] = React.useState('');
  const [levels, setLevels] = React.useState({ERROR: true, FATAL: true, WARN: true, INFO: true});
  const [selected, setSelected] = React.useState(null);
  const [bookmarks, setBookmarks] = React.useState({}); // {fileId: Set(lineIdx)}
  const [tail, setTail] = React.useState(false);
  const streamRef = React.useRef(null);

  React.useEffect(() => {
    if (!activeId && files.length) setActiveId(files[0].id);
  }, [files]);

  const active = files.find(f => f.id === activeId);

  // compute pattern matches across all files
  const matches = React.useMemo(() => {
    if (!active) return { lineToPattern: {}, count: 0 };
    const res = window.PatternEngine.matchAgainstKB(active.lines, kb, 0.5);
    const map = {};
    res.matches.forEach(m => {
      m.matchedLineIdxs.forEach(idx => { map[idx] = m.pattern; });
    });
    return { lineToPattern: map, count: Object.keys(map).length };
  }, [active, kb]);

  // filtered line indices
  const filtered = React.useMemo(() => {
    if (!active) return [];
    const q = query.trim().toLowerCase();
    const idxs = [];
    active.lines.forEach((ln, i) => {
      if (!levels[ln.level]) return;
      if (q && !ln.msg.toLowerCase().includes(q)) return;
      idxs.push(i);
    });
    return idxs;
  }, [active, query, levels]);

  const counts = React.useMemo(() => {
    if (!active) return {ERROR:0, WARN:0, INFO:0, FATAL:0};
    const c = {ERROR:0, WARN:0, INFO:0, FATAL:0};
    active.lines.forEach(l => { if (c[l.level] != null) c[l.level]++; });
    return c;
  }, [active]);

  // tail mode — auto-scroll to bottom
  React.useEffect(() => {
    if (tail && streamRef.current) {
      streamRef.current.scrollTop = streamRef.current.scrollHeight;
    }
  }, [tail, filtered.length, activeId]);

  const toggleBookmark = (idx) => {
    setBookmarks(prev => {
      const next = {...prev};
      const s = new Set(next[activeId] || []);
      if (s.has(idx)) s.delete(idx); else s.add(idx);
      next[activeId] = s;
      return next;
    });
  };

  const highlightText = (text, q) => {
    if (!q) return text;
    const lo = text.toLowerCase();
    const qq = q.toLowerCase();
    const parts = [];
    let i = 0;
    while (i < text.length) {
      const hit = lo.indexOf(qq, i);
      if (hit === -1) { parts.push(text.slice(i)); break; }
      if (hit > i) parts.push(text.slice(i, hit));
      parts.push(<mark key={hit}>{text.slice(hit, hit+qq.length)}</mark>);
      i = hit + qq.length;
    }
    return parts;
  };

  const handleUpload = async (fileList) => {
    const arr = [];
    for (const f of fileList) {
      const text = await f.text();
      const lines = text.split(/\r?\n/).filter(l => l.trim()).slice(0, 500).map(raw => {
        const tsMatch = raw.match(/(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}[.\dZ+:-]*)/);
        const lvlMatch = raw.match(/\b(INFO|WARN(?:ING)?|ERROR|FATAL|DEBUG|TRACE)\b/i);
        return { ts: tsMatch?tsMatch[1]:'', level: lvlMatch?lvlMatch[1].toUpperCase().replace('WARNING','WARN'):'INFO', msg: raw, raw };
      });
      const cat = window.PatternEngine.detectCategory(lines);
      arr.push({
        id: f.name+'-'+Date.now(), name: f.name, size: f.size, lines,
        type: cat === 'database_logs' ? 'db' : cat === 'api_logs' ? 'api' : cat === 'infra_logs' ? 'infra' : 'unknown',
      });
    }
    onAddFiles(arr);
  };

  const loadSample = () => onAddFiles(window.SAMPLE_LOGS.map(l => ({...l, id: l.id+'-'+Date.now()})));

  if (files.length === 0) {
    return (
      <div style={{padding:'60px', display:'flex', flexDirection:'column', alignItems:'center', gap:20, height:'100%', justifyContent:'center'}}>
        <div style={{fontSize: 22, fontFamily: 'var(--font-display)', fontWeight: 300}}>
          Open a <strong>log file</strong> to begin reading
        </div>
        <div style={{color:'var(--fg-3)', fontSize: 13, maxWidth: 460, textAlign:'center'}}>
          Trace Miner reads .log files like a standard viewer — and highlights lines that match known failure patterns in the knowledge base.
        </div>
        <div style={{display:'flex', gap:12, marginTop:12}}>
          <label className="primary-btn" style={{width:'auto', padding:'12px 24px', cursor:'pointer'}}>
            Open log files
            <input type="file" multiple accept=".log,.txt,.json" style={{display:'none'}} onChange={e => handleUpload([...e.target.files])}/>
          </label>
          <button className="btn-sample" onClick={loadSample} style={{padding:'12px 24px'}}>Load sample bundle</button>
        </div>
      </div>
    );
  }

  const selectedLine = active && selected != null ? active.lines[selected] : null;
  const selectedPattern = selected != null ? matches.lineToPattern[selected] : null;

  return (
    <div className="logviewer">
      <div className="lv-sidebar">
        <div style={{padding:'14px 14px 8px', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
          <div className="eyebrow">Open files</div>
          <label style={{cursor:'pointer', color:'var(--accent)', fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase'}}>
            + Add
            <input type="file" multiple accept=".log,.txt,.json" style={{display:'none'}} onChange={e => handleUpload([...e.target.files])}/>
          </label>
        </div>
        <div className="lv-files">
          {files.map(f => {
            const errs = f.lines.filter(l => l.level==='ERROR'||l.level==='FATAL').length;
            const warns = f.lines.filter(l => l.level==='WARN').length;
            return (
              <div key={f.id} className={"lv-file" + (activeId===f.id?' active':'')} onClick={() => setActiveId(f.id)}>
                <window.FileTypeIcon type={f.type}/>
                <div className="lv-body">
                  <div className="lv-name">{f.name}</div>
                  <div className="lv-meta">{f.lines.length} lines</div>
                </div>
                <div className="lv-counts">
                  {errs>0 && <span className="c err">{errs}</span>}
                  {warns>0 && <span className="c warn">{warns}</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="lv-main">
        <div className="lv-toolbar">
          <div className="lv-search">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16" y2="16" strokeLinecap="round"/></svg>
            <input placeholder="Search… e.g. timeout, OOMKilled" value={query} onChange={e => setQuery(e.target.value)}/>
          </div>
          <div className="lv-filters">
            {['ERROR','WARN','INFO'].map(lvl => (
              <button key={lvl}
                className={"lv-filter " + lvl + (levels[lvl]?' active':'')}
                onClick={() => setLevels(p => ({...p, [lvl]: !p[lvl], FATAL: lvl==='ERROR' ? !p.ERROR : p.FATAL}))}>
                {lvl} · {counts[lvl] + (lvl==='ERROR'?counts.FATAL:0)}
              </button>
            ))}
          </div>
          <span className="stat-chip">Showing <strong>{filtered.length}</strong> / {active?.lines.length||0}</span>
          <span className="stat-chip" style={{color:'var(--accent)'}}><strong>{matches.count}</strong> match {matches.count===1?'':'es'}</span>
          <button className={"lv-tail" + (tail?' on':'')} onClick={() => setTail(t => !t)}>
            <span className="tdot"/> Tail
          </button>
        </div>

        <div className="lv-stream" ref={streamRef}>
          {filtered.map(idx => {
            const line = active.lines[idx];
            const pat = matches.lineToPattern[idx];
            const bm = (bookmarks[activeId]||new Set()).has(idx);
            return (
              <div key={idx} className={"lv-line" + (selected===idx?' selected':'') + (bm?' bookmarked':'') + (pat?' matched-pattern':'')} onClick={() => setSelected(idx)}>
                <span className="lv-bookmark" onClick={e => { e.stopPropagation(); toggleBookmark(idx); }}>★</span>
                <span className="lv-ln">{String(idx+1).padStart(4,'0')}</span>
                <span className="lv-ts">{(line.ts||'').slice(11,19) || '—'}</span>
                <span className={"lv-lvl " + line.level}>{line.level}</span>
                <span className="lv-msg">{highlightText(line.msg, query)}</span>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div style={{padding: 40, textAlign:'center', color:'var(--fg-3)', fontSize: 13}}>No lines match the current filter.</div>
          )}
        </div>
      </div>

      <div className="lv-details">
        {selectedLine ? (
          <>
            <h3>Log line {selected+1}</h3>
            <div className="kv"><div className="k">Timestamp</div><div className="v">{selectedLine.ts || '—'}</div></div>
            <div className="kv"><div className="k">Level</div><div className="v"><span className={"lvl " + selectedLine.level} style={{color: selectedLine.level==='ERROR'||selectedLine.level==='FATAL'?'var(--accent)': selectedLine.level==='WARN'?'#B88100':'var(--fg-2)', fontWeight:700}}>{selectedLine.level}</span></div></div>
            <div className="kv"><div className="k">Source file</div><div className="v">{active.name}</div></div>
            <div className="kv"><div className="k">Message</div></div>
            <div className="lv-msg-box">{selectedLine.msg}</div>

            {selectedPattern ? (
              <div className="lv-match-card" onClick={() => onOpenPattern(selectedPattern.id)}>
                <div className="mc-id">MATCHED · {selectedPattern.id}</div>
                <div className="mc-title">{selectedPattern.title}</div>
                <div className="mc-cta">Open pattern →</div>
              </div>
            ) : (selectedLine.level==='ERROR' || selectedLine.level==='FATAL' || selectedLine.level==='WARN') && (
              <div style={{marginTop:16, padding:12, border:'1px dashed var(--border-hair)', fontSize:12, color:'var(--fg-3)', lineHeight:1.5}}>
                No known pattern matches this line. Run pattern mining to surface it as a new candidate.
              </div>
            )}
          </>
        ) : (
          <>
            <h3>Inspect a line</h3>
            <div style={{fontSize:12, color:'var(--fg-3)', lineHeight:1.55}}>
              Click any line to see timestamps, level, matched pattern, and historical context.
              Bookmark lines with the ★ to pin them across sessions.
            </div>
            {Object.values(bookmarks).some(s => s.size>0) && (
              <>
                <h3 style={{marginTop:24}}>Bookmarks</h3>
                {files.flatMap(f => [...(bookmarks[f.id]||new Set())].map(idx => ({file:f, idx, line: f.lines[idx]}))).slice(0,8).map(({file, idx, line}, i) => (
                  <div key={i} style={{fontSize:12, padding:'8px 0', borderBottom:'1px solid var(--border-hair)', cursor:'pointer'}} onClick={() => { setActiveId(file.id); setSelected(idx); }}>
                    <div style={{fontFamily:'var(--mono)', fontSize:10, color:'var(--fg-3)'}}>{file.name} · {String(idx+1).padStart(4,'0')}</div>
                    <div style={{color:'var(--fg-1)', fontFamily:'var(--mono)', fontSize:11, marginTop:2, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{line.msg}</div>
                  </div>
                ))}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// expose FileTypeIcon for sidebar
window.FileTypeIcon = function FileTypeIcon({ type }) {
  return <div className={`fi-type ${type||'unknown'}`}>{(type||'??').slice(0,3).toUpperCase()}</div>;
};
window.LogViewer = LogViewer;
