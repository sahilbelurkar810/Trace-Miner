// LogStream — shared, controlled log-reading surface used by both the
// Log Viewer page (detailsMode="pane") and the Miner page's live Scanner
// (detailsMode="drawer", plus live KB matching and a scan-cursor overlay).
// Holds no state of its own beyond the details-drawer's open/closed flag
// (pure UI chrome, not data) — everything else is derived from props so
// both pages can render it against the same underlying file/kb/bookmarks.

window.FileTypeIcon = function FileTypeIcon({ type }) {
  return <div className={`fi-type ${type || 'unknown'}`}>{(type || '??').slice(0, 3).toUpperCase()}</div>;
};

window.highlightText = function highlightText(text, q) {
  if (!q) return text;
  const lo = text.toLowerCase();
  const qq = q.toLowerCase();
  const parts = [];
  let i = 0;
  while (i < text.length) {
    const hit = lo.indexOf(qq, i);
    if (hit === -1) { parts.push(text.slice(i)); break; }
    if (hit > i) parts.push(text.slice(i, hit));
    parts.push(<mark key={hit}>{text.slice(hit, hit + qq.length)}</mark>);
    i = hit + qq.length;
  }
  return parts;
};

function LogLine({ idx, line, selected, bookmarked, matchedPattern, dimmed, scanning, query, onSelect, onToggleBookmark }) {
  return (
    <div data-lv-idx={idx}
      className={"lv-line"
        + (selected ? ' selected' : '')
        + (bookmarked ? ' bookmarked' : '')
        + (matchedPattern ? ' matched-pattern' : '')
        + (dimmed ? ' dimmed' : '')
        + (scanning ? ' scanning' : '')}
      onClick={() => onSelect(idx)}>
      <span className="lv-bookmark" onClick={e => { e.stopPropagation(); onToggleBookmark(idx); }}>★</span>
      <span className="lv-ln">{String(idx + 1).padStart(4, '0')}</span>
      <span className="lv-ts">{(line.ts || '').slice(11, 19) || '—'}</span>
      <span className={"lv-lvl " + line.level}>{line.level}</span>
      <span className="lv-msg">{window.highlightText(line.msg, query)}</span>
    </div>
  );
}

function DetailsPanel({ mode, file, files, selectedIdx, selectedLine, selectedPattern, bookmarks, onOpenPattern, onJumpBookmark }) {
  const [open, setOpen] = React.useState(true);

  const body = selectedLine ? (
    <>
      <h3>Log line {selectedIdx + 1}</h3>
      <div className="kv"><div className="k">Timestamp</div><div className="v">{selectedLine.ts || '—'}</div></div>
      <div className="kv"><div className="k">Level</div><div className="v"><span className={"lvl " + selectedLine.level} style={{ color: selectedLine.level === 'ERROR' || selectedLine.level === 'FATAL' ? 'var(--accent)' : selectedLine.level === 'WARN' ? '#B88100' : 'var(--fg-2)', fontWeight: 700 }}>{selectedLine.level}</span></div></div>
      <div className="kv"><div className="k">Source file</div><div className="v">{file && file.name}</div></div>
      <div className="kv"><div className="k">Message</div></div>
      <div className="lv-msg-box">{selectedLine.msg}</div>

      {selectedPattern ? (
        <div className="lv-match-card" onClick={() => onOpenPattern(selectedPattern.id)}>
          <div className="mc-id">MATCHED · {selectedPattern.id}</div>
          <div className="mc-title">{selectedPattern.title}</div>
          <div className="mc-cta">Open pattern →</div>
        </div>
      ) : (selectedLine.level === 'ERROR' || selectedLine.level === 'FATAL' || selectedLine.level === 'WARN') && (
        <div style={{ marginTop: 16, padding: 12, border: '1px dashed var(--border-hair)', fontSize: 12, color: 'var(--fg-3)', lineHeight: 1.5 }}>
          No known pattern matches this line. Run pattern mining to surface it as a new candidate.
        </div>
      )}
    </>
  ) : (
    <>
      <h3>Inspect a line</h3>
      <div style={{ fontSize: 12, color: 'var(--fg-3)', lineHeight: 1.55 }}>
        Click any line to see timestamps, level, matched pattern, and historical context.
        Bookmark lines with the ★ to pin them across sessions.
      </div>
      {Object.values(bookmarks || {}).some(s => s.size > 0) && (
        <>
          <h3 style={{ marginTop: 24 }}>Bookmarks</h3>
          {(files || []).flatMap(f => [...(bookmarks[f.id] || new Set())].map(idx => ({ file: f, idx, line: f.lines[idx] }))).slice(0, 8).map(({ file: f, idx, line }, i) => (
            <div key={i} style={{ fontSize: 12, padding: '8px 0', borderBottom: '1px solid var(--border-hair)', cursor: 'pointer' }} onClick={() => onJumpBookmark(f.id, idx)}>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--fg-3)' }}>{f.name} · {String(idx + 1).padStart(4, '0')}</div>
              <div style={{ color: 'var(--fg-1)', fontFamily: 'var(--mono)', fontSize: 11, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{line.msg}</div>
            </div>
          ))}
        </>
      )}
    </>
  );

  if (mode === 'drawer') {
    return (
      <div className={"lv-drawer" + (open ? ' open' : ' collapsed')}>
        <div className="lv-drawer-head" onClick={() => setOpen(o => !o)}>
          <span>{selectedLine ? `Line ${selectedIdx + 1} details` : 'Inspector'}</span>
          <span className="lv-drawer-caret">{open ? '▾' : '▸'}</span>
        </div>
        {open && <div className="lv-details">{body}</div>}
      </div>
    );
  }
  return <div className="lv-details">{body}</div>;
}

// Controlled shared reader: search/filter/tail/bookmarks/details/scrubber.
// No internal state beyond drawer-open (pure chrome) — everything else is
// derived from props each render, so two instances can safely point at the
// same underlying data without fighting each other.
function LogStream({
  file, files, kb,
  reader, onReaderChange,
  selection, onSelect, onJumpBookmark,
  bookmarks, onToggleBookmark,
  timeWindow, onTimeWindowChange,
  focusLineIdx,
  onOpenPattern,
  detailsMode = 'pane', showScrubber = true,
  header, className,
  emptyMessage,
}) {
  const streamRef = React.useRef(null);
  const query = (reader && reader.query) || '';
  const levels = (reader && reader.levels) || { ERROR: true, FATAL: true, WARN: true, INFO: true };
  const tail = !!(reader && reader.tail);

  const fileId = file ? file.id : null;
  const selectedIdx = (selection && selection.fileId === fileId) ? selection.idx : null;

  const timeIndex = React.useMemo(() => {
    if (!file) return { stamps: [], hasTime: false, min: 0, max: 0 };
    const stamps = file.lines.map(ln => {
      if (!ln.ts) return null;
      const t = new Date(ln.ts.replace(' ', 'T'));
      return isNaN(t) ? null : t.getTime();
    });
    const valid = stamps.filter(x => x != null);
    if (valid.length < 2) return { stamps, hasTime: false, min: 0, max: 0 };
    return { stamps, hasTime: true, min: Math.min(...valid), max: Math.max(...valid) };
  }, [file]);

  // Derived, not reset by an effect: absence of an explicit window means
  // "full span". Switching files or new lines shifting min/max never fights
  // a window the user narrowed by hand — see plan notes on this.
  const effectiveWindow = React.useMemo(() => {
    if (!timeIndex.hasTime) return null;
    if (!timeWindow) return [timeIndex.min, timeIndex.max];
    const lo = Math.max(timeWindow[0], timeIndex.min);
    const hi = Math.min(timeWindow[1], timeIndex.max);
    if (lo >= hi) return [timeIndex.min, timeIndex.max];
    return [lo, hi];
  }, [timeWindow, timeIndex]);

  const matches = React.useMemo(() => {
    if (!file || !kb) return { lineToPattern: {}, count: 0 };
    const res = window.PatternEngine.matchAgainstKB(file.lines, kb, 0.5);
    const map = {};
    res.matches.forEach(m => { m.matchedLineIdxs.forEach(idx => { map[idx] = m.pattern; }); });
    return { lineToPattern: map, count: Object.keys(map).length };
  }, [file, kb]);

  const inTimeWindow = React.useCallback((idx) => {
    if (!effectiveWindow || !timeIndex.hasTime) return true;
    const t = timeIndex.stamps[idx];
    if (t == null) return true;
    return t >= effectiveWindow[0] && t <= effectiveWindow[1];
  }, [effectiveWindow, timeIndex]);

  const filtered = React.useMemo(() => {
    if (!file) return [];
    const q = query.trim().toLowerCase();
    const idxs = [];
    file.lines.forEach((ln, i) => {
      if (!levels[ln.level]) return;
      if (q && !ln.msg.toLowerCase().includes(q)) return;
      idxs.push(i);
    });
    return idxs;
  }, [file, query, levels]);

  const counts = React.useMemo(() => window.LogParse.levelCounts(file), [file]);

  // Auto-scroll priority: an external scan cursor wins, then tail mode,
  // then the time window. One effect, one branch taken — not three effects
  // racing each other.
  React.useEffect(() => {
    if (!streamRef.current) return;
    if (focusLineIdx != null) {
      const el = streamRef.current.querySelector(`[data-lv-idx="${focusLineIdx}"]`);
      if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      return;
    }
    if (tail) {
      streamRef.current.scrollTop = streamRef.current.scrollHeight;
      return;
    }
    if (effectiveWindow && timeIndex.hasTime) {
      const firstInWindow = filtered.find(i => {
        const t = timeIndex.stamps[i];
        return t == null || (t >= effectiveWindow[0] && t <= effectiveWindow[1]);
      });
      if (firstInWindow == null) return;
      const el = streamRef.current.querySelector(`[data-lv-idx="${firstInWindow}"]`);
      if (!el) return;
      const sRect = streamRef.current.getBoundingClientRect();
      const eRect = el.getBoundingClientRect();
      const delta = eRect.top - sRect.top - 12;
      streamRef.current.scrollBy({ top: delta, behavior: 'smooth' });
    }
  }, [focusLineIdx, tail, fileId, filtered.length, effectiveWindow && effectiveWindow[0], effectiveWindow && effectiveWindow[1]]);

  const selectedLine = (file && selectedIdx != null) ? file.lines[selectedIdx] : null;
  const selectedPattern = selectedIdx != null ? matches.lineToPattern[selectedIdx] : null;

  return (
    <>
      {header}
      <div className={"lv-main" + (className ? ' ' + className : '')}>
        <div className="lv-toolbar">
          <div className="lv-search">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16" y2="16" strokeLinecap="round" /></svg>
            <input placeholder="Search… e.g. timeout, OOMKilled" value={query} onChange={e => onReaderChange({ query: e.target.value })} />
          </div>
          <div className="lv-filters">
            {['ERROR', 'WARN', 'INFO'].map(lvl => (
              <button key={lvl}
                className={"lv-filter " + lvl + (levels[lvl] ? ' active' : '')}
                onClick={() => onReaderChange({ levels: { ...levels, [lvl]: !levels[lvl], FATAL: lvl === 'ERROR' ? !levels.ERROR : levels.FATAL } })}>
                {lvl} · {counts[lvl] + (lvl === 'ERROR' ? counts.FATAL : 0)}
              </button>
            ))}
          </div>
          <span className="stat-chip">Showing <strong>{filtered.length}</strong> / {(file && file.lines.length) || 0}</span>
          {kb && <span className="stat-chip" style={{ color: 'var(--accent)' }}><strong>{matches.count}</strong> match{matches.count === 1 ? '' : 'es'}</span>}
          <button className={"lv-tail" + (tail ? ' on' : '')} onClick={() => onReaderChange({ tail: !tail })}>
            <span className="tdot" /> Tail
          </button>
        </div>

        <div className="lv-stream" ref={streamRef}>
          {file && filtered.map(idx => (
            <LogLine key={idx} idx={idx} line={file.lines[idx]}
              selected={selectedIdx === idx}
              bookmarked={((bookmarks && bookmarks[fileId]) || new Set()).has(idx)}
              matchedPattern={matches.lineToPattern[idx]}
              dimmed={!inTimeWindow(idx)}
              scanning={focusLineIdx === idx}
              query={query}
              onSelect={(i) => onSelect(fileId, i)}
              onToggleBookmark={(i) => onToggleBookmark(fileId, i)} />
          ))}
          {file && filtered.length === 0 && (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--fg-3)', fontSize: 13 }}>No lines match the current filter.</div>
          )}
          {!file && (
            <div style={{ padding: '60px 24px', textAlign: 'center', color: 'var(--fg-3)', fontSize: 13, lineHeight: 1.6 }}>
              {emptyMessage || (<>
                Logs will appear here once uploaded.<br />
                Each line is tokenised, compared against known patterns, and<br />
                indexed for future recognition.
              </>)}
            </div>
          )}
        </div>

        {showScrubber && timeIndex.hasTime && effectiveWindow && (
          <TimeScrubber
            timeIndex={timeIndex}
            value={effectiveWindow}
            onChange={onTimeWindowChange}
            lines={file.lines} />
        )}
      </div>

      {detailsMode !== 'none' && (
        <DetailsPanel
          mode={detailsMode}
          file={file} files={files}
          selectedIdx={selectedIdx} selectedLine={selectedLine} selectedPattern={selectedPattern}
          bookmarks={bookmarks}
          onOpenPattern={onOpenPattern}
          onJumpBookmark={onJumpBookmark} />
      )}
    </>
  );
}

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
          <button className="scrub-reset" onClick={() => onChange(null)}>Reset</button>
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

window.LogStream = LogStream;
window.TimeScrubber = TimeScrubber;
