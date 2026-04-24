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
  const [timeWindow, setTimeWindow] = React.useState(null); // [startIdx, endIdx] for active file
  const streamRef = React.useRef(null);

  React.useEffect(() => {
    if (!activeId && files.length) setActiveId(files[0].id);
  }, [files]);

  const active = files.find(f => f.id === activeId);

  // Parse timestamps into numeric indices for time-travel
  const timeIndex = React.useMemo(() => {
    if (!active) return { stamps: [], hasTime: false, min: 0, max: 0 };
    const stamps = active.lines.map((ln, i) => {
      if (!ln.ts) return null;
      const t = new Date(ln.ts.replace(' ', 'T'));
      return isNaN(t) ? null : t.getTime();
    });
    const valid = stamps.filter(x => x != null);
    if (valid.length < 2) return { stamps, hasTime: false, min: 0, max: 0 };
    return { stamps, hasTime: true, min: Math.min(...valid), max: Math.max(...valid) };
  }, [active]);

  // Reset time window when file changes
  React.useEffect(() => {
    if (timeIndex.hasTime) setTimeWindow([timeIndex.min, timeIndex.max]);
    else setTimeWindow(null);
  }, [activeId, timeIndex.hasTime, timeIndex.min, timeIndex.max]);

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

  // filtered line indices + in/out of time window
  const inTimeWindow = React.useCallback((idx) => {
    if (!timeWindow || !timeIndex.hasTime) return true;
    const t = timeIndex.stamps[idx];
    if (t == null) return true; // lines without timestamps always show
    return t >= timeWindow[0] && t <= timeWindow[1];
  }, [timeWindow, timeIndex]);

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

  // Auto-scroll: when the time window moves, scroll to the first in-window line
  React.useEffect(() => {
    if (!timeWindow || !timeIndex.hasTime || !streamRef.current || tail) return;
    // find first filtered idx whose timestamp is in-window
    const firstInWindow = filtered.find(i => {
      const t = timeIndex.stamps[i];
      return t == null || (t >= timeWindow[0] && t <= timeWindow[1]);
    });
    if (firstInWindow == null) return;
    const el = streamRef.current.querySelector(`[data-lv-idx="${firstInWindow}"]`);
    if (!el) return;
    const sRect = streamRef.current.getBoundingClientRect();
    const eRect = el.getBoundingClientRect();
    const delta = eRect.top - sRect.top - 12;
    streamRef.current.scrollBy({ top: delta, behavior: 'smooth' });
  }, [timeWindow && timeWindow[0], timeWindow && timeWindow[1]]);

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
              <div key={idx} data-lv-idx={idx} className={"lv-line" + (selected===idx?' selected':'') + (bm?' bookmarked':'') + (pat?' matched-pattern':'') + (!inTimeWindow(idx)?' dimmed':'')} onClick={() => setSelected(idx)}>
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

        {timeIndex.hasTime && timeWindow && <TimeScrubber
          timeIndex={timeIndex}
          value={timeWindow}
          onChange={setTimeWindow}
          lines={active.lines}
        />}
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

// ── Time-travel scrubber ──────────────────────────────────────────────
// Dual-range slider across the log's time span, with a density histogram
// of events (error/warn/info) behind. Dragging either handle dims lines
// outside the window in the main stream.
function TimeScrubber({ timeIndex, value, onChange, lines }) {
  const { min, max, stamps } = timeIndex;
  const span = max - min || 1;
  const [dragging, setDragging] = React.useState(null); // 'lo' | 'hi' | 'range' | null
  const trackRef = React.useRef(null);
  const dragStateRef = React.useRef(null);

  const pct = (t) => ((t - min) / span) * 100;
  const fromPct = (p) => min + (p / 100) * span;

  // Histogram: 40 buckets, count per severity
  const buckets = React.useMemo(() => {
    const N = 40;
    const arr = Array.from({length: N}, () => ({err: 0, warn: 0, info: 0}));
    stamps.forEach((t, i) => {
      if (t == null) return;
      const b = Math.min(N-1, Math.floor(((t - min) / span) * N));
      const lvl = lines[i].level;
      if (lvl === 'ERROR' || lvl === 'FATAL') arr[b].err++;
      else if (lvl === 'WARN') arr[b].warn++;
      else arr[b].info++;
    });
    const maxBucket = Math.max(1, ...arr.map(b => b.err + b.warn + b.info));
    return { arr, maxBucket };
  }, [stamps, lines, min, span]);

  const pctFromEvent = (e) => {
    const rect = trackRef.current.getBoundingClientRect();
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    return Math.max(0, Math.min(100, (x / rect.width) * 100));
  };

  const onHandleDown = (which) => (e) => {
    e.preventDefault(); e.stopPropagation();
    setDragging(which);
  };

  const onRangeDown = (e) => {
    e.preventDefault();
    const p = pctFromEvent(e);
    const loP = pct(value[0]); const hiP = pct(value[1]);
    dragStateRef.current = { startP: p, loP, hiP };
    setDragging('range');
  };

  React.useEffect(() => {
    if (!dragging) return;
    const onMove = (e) => {
      const p = pctFromEvent(e);
      window.Aura && window.Aura.uiDrag && window.Aura.uiDrag();
      if (dragging === 'lo') {
        const t = fromPct(p);
        onChange([Math.min(t, value[1] - span*0.01), value[1]]);
      } else if (dragging === 'hi') {
        const t = fromPct(p);
        onChange([value[0], Math.max(t, value[0] + span*0.01)]);
      } else if (dragging === 'range') {
        const st = dragStateRef.current;
        const delta = p - st.startP;
        let newLo = st.loP + delta, newHi = st.hiP + delta;
        if (newLo < 0) { newHi -= newLo; newLo = 0; }
        if (newHi > 100) { newLo -= (newHi - 100); newHi = 100; }
        onChange([fromPct(newLo), fromPct(newHi)]);
      }
    };
    const onUp = () => setDragging(null);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onMove);
    window.addEventListener('touchend', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
    };
  }, [dragging, value, onChange, span]);

  const fmt = (t) => {
    const d = new Date(t);
    const pad = n => String(n).padStart(2,'0');
    return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  };
  const fmtDate = (t) => {
    const d = new Date(t);
    const pad = n => String(n).padStart(2,'0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${fmt(t)}`;
  };
  const loP = pct(value[0]); const hiP = pct(value[1]);
  const windowedCount = stamps.filter(t => t != null && t >= value[0] && t <= value[1]).length;
  const totalTimestamped = stamps.filter(t => t != null).length;
  const isFull = loP < 0.5 && hiP > 99.5;

  return (
    <div className="lv-scrubber">
      <div className="scrub-head">
        <div className="scrub-label">
          <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="8" r="6.5"/><path d="M8 4v4l2.5 2.5" strokeLinecap="round"/></svg>
          <span>Time travel</span>
        </div>
        <div className="scrub-window">
          <span className="sw-t">{fmt(value[0])}</span>
          <span className="sw-arr">→</span>
          <span className="sw-t">{fmt(value[1])}</span>
          <span className="sw-count">· {windowedCount}/{totalTimestamped} lines</span>
        </div>
        {!isFull && (
          <button className="scrub-reset" onClick={() => onChange([min, max])}>Reset</button>
        )}
      </div>
      <div className="scrub-track" ref={trackRef}>
        <div className="scrub-histo">
          {buckets.arr.map((b, i) => {
            const total = b.err + b.warn + b.info;
            const h = total / buckets.maxBucket * 100;
            return (
              <div key={i} className="scrub-bar" style={{height: h + '%'}}>
                {b.err > 0 && <div className="bar err" style={{height: (b.err/total*100)+'%'}}/>}
                {b.warn > 0 && <div className="bar warn" style={{height: (b.warn/total*100)+'%'}}/>}
                {b.info > 0 && <div className="bar info" style={{height: (b.info/total*100)+'%'}}/>}
              </div>
            );
          })}
        </div>
        <div className="scrub-mask left" style={{width: loP + '%'}}/>
        <div className="scrub-mask right" style={{width: (100 - hiP) + '%'}}/>
        <div className="scrub-range" style={{left: loP + '%', width: (hiP - loP) + '%'}} onMouseDown={onRangeDown} onTouchStart={onRangeDown}/>
        <div className="scrub-handle lo" style={{left: loP + '%'}} onMouseDown={onHandleDown('lo')} onTouchStart={onHandleDown('lo')} title={fmtDate(value[0])}>
          <span className="hdl-grip"/>
        </div>
        <div className="scrub-handle hi" style={{left: hiP + '%'}} onMouseDown={onHandleDown('hi')} onTouchStart={onHandleDown('hi')} title={fmtDate(value[1])}>
          <span className="hdl-grip"/>
        </div>
      </div>
      <div className="scrub-axis">
        <span>{fmt(min)}</span>
        <span>{fmt(min + span*0.25)}</span>
        <span>{fmt(min + span*0.5)}</span>
        <span>{fmt(min + span*0.75)}</span>
        <span>{fmt(max)}</span>
      </div>
    </div>
  );
}

window.LogViewer = LogViewer;
