// Dashboard — Miner page. No robot. Glassmorphic scan splash during processing.

const CATEGORY_LABELS = {
  database_logs: 'Database',
  api_logs: 'API',
  infra_logs: 'Infrastructure',
  unknown_logs: 'Unknown',
};

function FileTypeIcon({ type }) {
  return <div className={`fi-type ${type||'unknown'}`}>{(type||'??').slice(0,3).toUpperCase()}</div>;
}

function UploadPanel({ files, onAdd, onRemove, onProcess, processing }) {
  const [over, setOver] = React.useState(false);

  const handleFiles = async (fileList) => {
    const arr = [];
    for (const f of fileList) {
      const text = await f.text();
      const lines = parseLogText(text, f.name);
      const cat = window.PatternEngine.detectCategory(lines);
      arr.push({
        id: f.name + '-' + Date.now(),
        name: f.name, size: f.size,
        type: cat === 'database_logs' ? 'db' : cat === 'api_logs' ? 'api' : cat === 'infra_logs' ? 'infra' : 'unknown',
        lines,
      });
    }
    onAdd(arr);
  };

  const onDrop = (e) => {
    e.preventDefault(); setOver(false);
    handleFiles([...e.dataTransfer.files]);
  };

  const loadSample = () => {
    const picked = window.SAMPLE_LOGS.map(l => ({ ...l, id: l.id+'-'+Date.now() }));
    onAdd(picked);
  };

  return (
    <div className="panel left">
      <div className="panel-header">
        <div>
          <div className="eyebrow">Ingestion</div>
          <h2>Upload <strong>logs</strong></h2>
        </div>
      </div>
      <div className="panel-body">
        <div className={"dropzone" + (over?" over":"")}
             onDragOver={e => { e.preventDefault(); setOver(true); }}
             onDragLeave={() => setOver(false)} onDrop={onDrop}>
          <svg className="dz-icon" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M24 32V10M24 10l-8 8M24 10l8 8" strokeLinecap="round"/>
            <path d="M8 30v6a2 2 0 0 0 2 2h28a2 2 0 0 0 2-2v-6"/>
          </svg>
          <div className="dz-title">Drop .log files here</div>
          <div className="dz-sub">or click to browse · multi-select</div>
          <input type="file" multiple accept=".log,.txt,.json"
            style={{position:'absolute', inset:0, opacity:0, cursor:'pointer'}}
            onChange={e => handleFiles([...e.target.files])}/>
          <div className="dz-or">— or —</div>
          <button className="btn-sample" onClick={e => { e.stopPropagation(); loadSample(); }}>
            Load sample bundle
          </button>
        </div>

        {files.length > 0 && (
          <div className="file-list">
            {files.map(f => (
              <div key={f.id} className={"file-item" + (processing && processing.fileId===f.id ? " scanning" : "")}>
                <FileTypeIcon type={f.type}/>
                <div className="fi-body">
                  <div className="fi-name">{f.name}</div>
                  <div className="fi-meta">{formatSize(f.size)} · {f.lines.length} lines</div>
                </div>
                {!processing && (
                  <button className="fi-remove" onClick={() => onRemove(f.id)}>×</button>
                )}
              </div>
            ))}
          </div>
        )}

        <button className="primary-btn" onClick={onProcess} disabled={files.length === 0 || !!processing}>
          {processing ? (<><span className="spinner"/> Processing…</>) : (<>Process logs <span className="arrow">→</span></>)}
        </button>
      </div>
    </div>
  );
}

function parseLogText(text, fileName) {
  const rows = text.split(/\r?\n/).filter(l => l.trim());
  return rows.slice(0, 500).map(raw => {
    const tsMatch = raw.match(/(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}[.\dZ+:-]*)/);
    const lvlMatch = raw.match(/\b(INFO|WARN(?:ING)?|ERROR|FATAL|DEBUG|TRACE)\b/i);
    return {
      ts: tsMatch ? tsMatch[1] : '',
      level: lvlMatch ? lvlMatch[1].toUpperCase().replace('WARNING','WARN') : 'INFO',
      msg: raw, raw,
    };
  });
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024*1024) return (bytes/1024).toFixed(1) + ' KB';
  return (bytes/1024/1024).toFixed(1) + ' MB';
}

// ========== Glassmorphic Scan Splash ==========
// Fullscreen overlay. Blurred dashboard behind, centered glass card,
// animated progress ring, streaming log cascade, cycling system messages.
const SYSTEM_MESSAGES = [
  'Parsing log entries',
  'Tokenising signatures',
  'Clustering failure patterns',
  'Matching against knowledge base',
  'Computing confidence scores',
  'Finalizing results',
];

function ScanSplash({ files, processing }) {
  const [msgIdx, setMsgIdx] = React.useState(0);
  const [msgKey, setMsgKey] = React.useState(0);

  React.useEffect(() => {
    if (!processing) return;
    const iv = setInterval(() => {
      setMsgIdx(i => (i + 1) % SYSTEM_MESSAGES.length);
      setMsgKey(k => k + 1);
    }, 1100);
    return () => clearInterval(iv);
  }, [!!processing]);

  if (!processing) return null;
  const activeFile = files.find(f => f.id === processing.fileId) || files[0];
  const lines = activeFile ? activeFile.lines : [];
  const lineIdx = processing.lineIdx ?? 0;
  const totalKnown = processing.totalKnownPatterns || 3;
  const progress = processing.progress || 0;

  const R = 56, C = 2*Math.PI*R;

  // A larger scrolling window for smooth continuous motion
  const start = Math.max(0, lineIdx - 4);
  const streamWin = lines.slice(start, start + 12);

  return (
    <div className="glass-splash">
      <div className="gs-bg"/>
      <div className="gs-particles">
        {Array.from({length: 24}).map((_, i) => (
          <span key={i} className="gs-p" style={{
            left: (i*4.3 % 100) + '%',
            animationDelay: (i*0.17) + 's',
            animationDuration: (5 + (i%4)) + 's',
          }}/>
        ))}
      </div>

      <div className="gs-card">
        <div className="gs-left">
          <div className="gs-eyebrow">Trace Miner</div>
          <div className="gs-title">
            Mining <strong>{files.length}</strong> {files.length===1?'file':'files'}
            <span style={{color:'rgba(255,255,255,0.5)', fontWeight:300}}> · </span>
            <strong>{totalKnown}</strong> known patterns
          </div>

          <div className="gs-ring-wrap">
            <svg className="gs-ring" viewBox="0 0 140 140">
              <circle cx="70" cy="70" r={R} fill="none" className="gs-bg-ring"/>
              <circle cx="70" cy="70" r={R} fill="none" className="gs-fg-ring"
                strokeDasharray={C} strokeDashoffset={C * (1-progress)}
                transform="rotate(-90 70 70)"/>
              <circle cx="70" cy="70" r={R-10} fill="none" className="gs-inner-ring"/>
              <text x="70" y="72" textAnchor="middle" className="gs-ring-t">{Math.round(progress*100)}</text>
              <text x="70" y="88" textAnchor="middle" className="gs-ring-p">%</text>
            </svg>
            <div className="gs-ring-caption">
              <span className="blink"/>
              <span key={msgKey} className="gs-sysmsg">
                {SYSTEM_MESSAGES[msgIdx]}<span className="gs-msgdots">…</span>
              </span>
            </div>
          </div>

          <div className="gs-metrics">
            <div><div className="k">File</div><div className="v">{(processing.fileIdx||0)+1}/{files.length}</div></div>
            <div><div className="k">Line</div><div className="v">{lineIdx+1}/{lines.length||'—'}</div></div>
            <div><div className="k">Known</div><div className="v">{totalKnown}</div></div>
            <div><div className="k">Stage</div><div className="v" style={{color:'var(--accent-yellow)'}}>{['PARSE','TOKENISE','EXTRACT','COMPARE','CLUSTER'][Math.min(4, Math.floor(progress*5))]}</div></div>
          </div>
        </div>

        <div className="gs-right">
          <div className="gs-rbar">
            <span className="gs-fname">{activeFile ? activeFile.name : 'awaiting input'}</span>
            <span className="gs-dots"><span/><span/><span/></span>
          </div>
          <div className="gs-stream">
            <div className="gs-stream-inner">
              {streamWin.map((ln, i) => {
                const abs = start + i;
                const active = abs === lineIdx;
                const highlight = /error|timeout|failed|refused|exception|fatal/i;
                const parts = (ln.msg || '').split(highlight).reduce((acc, part, idx, arr) => {
                  acc.push(<React.Fragment key={'p'+idx}>{part}</React.Fragment>);
                  if (idx < arr.length - 1) {
                    const kw = (ln.msg.match(highlight) || [])[idx];
                    if (kw) acc.push(<span key={'k'+idx} className="gs-kw">{kw}</span>);
                  }
                  return acc;
                }, []);
                return (
                  <div key={abs} className={"gs-ln" + (active?' active':'')}
                       style={{animationDelay: (i*40)+'ms'}}>
                    <span className="gs-ts">{(ln.ts||'').slice(11,19) || '--:--:--'}</span>
                    <span className={"gs-lvl " + ln.level}>{ln.level}</span>
                    <span className="gs-m">{parts}</span>
                  </div>
                );
              })}
              {streamWin.length < 10 && Array.from({length: 10-streamWin.length}).map((_, i) => (
                <div key={'pad'+i} className="gs-ln" style={{opacity: 0.2}}>
                  <span className="gs-ts">--:--:--</span>
                  <span className="gs-lvl INFO">····</span>
                  <span className="gs-m" style={{letterSpacing:'0.15em', color:'rgba(255,255,255,0.3)'}}>awaiting next chunk</span>
                </div>
              ))}
            </div>
            <div className="gs-scan-line"/>
            <div className="gs-stream-fade-top"/>
            <div className="gs-stream-fade-bot"/>
          </div>

          <div className="gs-prog-row">
            <div className="gs-prog">
              <div className="fill" style={{width: (progress*100)+'%'}}/>
            </div>
            <div className="gs-prog-pct">{Math.round(progress*100)}%</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ========== Live scan pane (file tabs + log view, no robot) ==========
function Scanner({ files, processing, results }) {
  const [visibleTab, setVisibleTab] = React.useState(null);
  const shownFile = files.find(f => f.id === (visibleTab || (files[0] && files[0].id)));
  const streamRef = React.useRef(null);

  const matchedLinesByFile = React.useMemo(() => {
    const m = {};
    if (!results) return m;
    results.fileResults.forEach(fr => {
      m[fr.file.id] = new Set(fr.matches.flatMap(x => x.matchedLineIdxs));
    });
    return m;
  }, [results]);

  // auto-switch to the file currently being processed
  React.useEffect(() => {
    if (processing?.fileId) setVisibleTab(processing.fileId);
  }, [processing?.fileId]);

  // auto-scroll to the line being scanned
  React.useEffect(() => {
    if (processing && streamRef.current) {
      const el = streamRef.current.querySelector(`[data-line="${processing.lineIdx}"]`);
      if (el) el.scrollIntoView({block:'center', behavior:'smooth'});
    }
  }, [processing?.lineIdx]);

  let state = 'idle';
  if (processing) state = 'scanning';
  else if (results) state = 'done';

  return (
    <div className="scanner" style={{position:'relative'}}>
      <div className="scanner-header">
        <div>
          <div className="eyebrow">Analysis</div>
          <h2>Live <strong>scan</strong></h2>
        </div>
        <div className={"scanner-state" + (state==='scanning'?' active':'') + (state==='done'?' done':'')}>
          <span className="sd"/>
          {state==='idle' && 'Awaiting input'}
          {state==='scanning' && `Scanning · ${files.length} file${files.length!==1?'s':''}`}
          {state==='done' && `Identified ${(results?.aggregated?.length||0)+(results?.newPatterns?.length||0)} pattern${((results?.aggregated?.length||0)+(results?.newPatterns?.length||0))!==1?'s':''}`}
        </div>
      </div>

      <div className="scanner-body no-robot">
        <div className="log-view full">
          <div className="log-tabs">
            {files.map(f => (
              <button key={f.id}
                className={"log-tab" + (shownFile && shownFile.id===f.id?' active':'') + (processing?.fileId===f.id?' processing':'')}
                onClick={() => setVisibleTab(f.id)}>
                <span className={"type-badge " + (f.type||'unknown')}/>
                {f.name}
              </button>
            ))}
            {files.length === 0 && (
              <div style={{padding:'20px', fontSize:12, color:'var(--fg-3)', fontFamily:'var(--mono)'}}>No logs loaded. Drop files on the left to begin.</div>
            )}
          </div>
          <div className="log-stream" ref={streamRef}>
            {shownFile && shownFile.lines.map((line, i) => {
              const isMatched = (matchedLinesByFile[shownFile.id] || new Set()).has(i);
              const isScanning = processing && processing.fileId===shownFile.id && i === processing.lineIdx;
              return (
                <div key={i} data-line={i} className={"log-line" + (isMatched?' matched':'') + (isScanning?' scanning':'')}>
                  <span className="ln">{String(i+1).padStart(3,'0')}</span>
                  <span className="ts">{(line.ts||'').slice(11,19) || '—'}</span>
                  <span className="m">
                    <span className={"lvl " + line.level}>{line.level}</span>
                    {' '}{line.msg}
                  </span>
                </div>
              );
            })}
            {!shownFile && (
              <div style={{padding:'60px 24px', textAlign:'center', color:'var(--fg-3)', fontSize:13, lineHeight: 1.6}}>
                Logs will appear here once uploaded.<br/>
                Each line is tokenised, compared against known patterns, and<br/>
                indexed for future recognition.
              </div>
            )}
          </div>
        </div>
      </div>

      <ScanSplash files={files} processing={processing}/>
    </div>
  );
}

function PatternCard({ pattern, hits, files, isNew, onOpen }) {
  const confidence = Math.round((pattern.confidence || 0.75) * 100);
  const hasAppliedFix = !!(pattern.applied_fix && (pattern.applied_fix.text || '').trim());
  return (
    <div className={"pattern-card" + (isNew?' new':'')} onClick={() => onOpen(pattern.id)}>
      <div className="pc-head">
        <span className="pc-id">{pattern.id}</span>
        {isNew ? <span className="pc-new-tag">New</span> : <span className="pc-id" style={{color:'var(--fg-3)'}}>{CATEGORY_LABELS[pattern.category] || ''}</span>}
      </div>
      <div className="pc-title">{pattern.title}</div>
      <div className="pc-meta">
        <span>Seen <strong style={{color:'var(--fg-1)'}}>{(pattern.frequency||0) + (hits||0)}×</strong></span>
        <span className="dot"/>
        <span>{(files || pattern.source_files || []).length} source{(files||pattern.source_files||[]).length!==1?'s':''}</span>
        {hasAppliedFix && <><span className="dot"/><span style={{color:'var(--accent-green-dark, #3a8522)', fontWeight: 700}}>✓ Fix applied</span></>}
      </div>
      <div className="pc-confidence">
        <span>{confidence}%</span>
        <div className="pc-bar"><div className="fill" style={{width: confidence+'%'}}/></div>
        <span>confidence</span>
      </div>
      <div className="pc-sources">
        {(files || pattern.source_files || []).slice(0,3).map((s,i) => (
          <span key={i} className="pc-src">{typeof s === 'string' ? s : s.name}</span>
        ))}
      </div>
    </div>
  );
}

function ResultsPanel({ files, results, onOpen }) {
  if (!results) {
    return (
      <div className="panel right">
        <div className="panel-header">
          <div>
            <div className="eyebrow">Findings</div>
            <h2>Detected <strong>patterns</strong></h2>
          </div>
        </div>
        <div className="panel-body">
          <div className="results-empty">
            Patterns will appear here once logs are processed.
            <br/><br/>
            The miner matches against the existing knowledge base, then surfaces any residual as candidate new patterns.
          </div>
        </div>
      </div>
    );
  }

  const totalHits = results.aggregated.reduce((s,a) => s + a.totalHits, 0);

  return (
    <div className="panel right">
      <div className="panel-header">
        <div>
          <div className="eyebrow">Findings</div>
          <h2>Detected <strong>patterns</strong></h2>
        </div>
      </div>
      <div className="panel-body">
        <div className="results-summary">
          <div className="stat"><div className="v">{results.aggregated.length}</div><div className="k">Matched</div></div>
          <div className="stat"><div className="v accent">{results.newPatterns.length}</div><div className="k">New</div></div>
          <div className="stat"><div className="v">{totalHits}</div><div className="k">Log hits</div></div>
          <div className="stat"><div className="v">{files.length}</div><div className="k">Files</div></div>
        </div>
        {results.aggregated.map(agg => (
          <PatternCard key={agg.pattern.id} pattern={agg.pattern} hits={agg.totalHits} files={agg.matchingFiles} onOpen={onOpen}/>
        ))}
        {results.newPatterns.map(p => (
          <PatternCard key={p.id} pattern={p} isNew onOpen={onOpen}/>
        ))}
      </div>
    </div>
  );
}

window.UploadPanel = UploadPanel;
window.Scanner = Scanner;
window.ResultsPanel = ResultsPanel;
window.PatternCard = PatternCard;
window.FileTypeIcon = FileTypeIcon;
window.CATEGORY_LABELS = CATEGORY_LABELS;
